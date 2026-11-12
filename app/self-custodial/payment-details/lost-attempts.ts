/**
 * What sends that threw after dispatch leave behind for the next send to the same
 * destination. It depends on nothing of the send path, so the wallet lifecycle can scope
 * it without pulling that in; only on where it keeps them across app launches.
 */
import type { ConvertAttemptRef } from "@app/types/payment"
import { withTimeout } from "@app/utils/with-timeout"

import { loadLostAttempts, saveLostAttempts } from "../storage/lost-attempts"

/**
 * The attempts of a send that threw after dispatch without their payment turning up: the
 * payment hash of each invoice they paid (or, for a Spark invoice, the invoice itself),
 * when the first of them was made, and the idempotency key they all went out under, if
 * they shared one. A retry under that key is refused by the SDK as a duplicate, so it
 * needs no look first; any other send does.
 */
export type LostSend = {
  startedAtMs: number
  /** When the latest of the attempts was made: what keeps them across app launches, so a
   *  recent attempt does not lapse with the first one. */
  lastAttemptAtMs?: number
  /**
   * When the newest send the wallet held was made, by the server's clock, as the
   * earliest of the attempts was lost (unix seconds; 0 when it held none or could not
   * be read). The attempts' payments are no older than it, whatever the phone's clock
   * says, so the look reaches back from it as well as from `startedAtMs`.
   */
  walletClockSec: number
  paymentHashes: string[]
  sparkInvoices: string[]
  idempotencyKey?: string
  /**
   * What the sender asked each attempt for, by what its payment is found by
   * (`hash:<payment hash>` or `invoice:<Spark invoice>`): what tells a payment found later
   * for this send from one an earlier attempt made for another amount.
   */
  requestedAs?: Record<string, RequestedAs>
}

/**
 * What a sender asked a send for: the amount as they entered it, and as it leaves the
 * sending wallet (each `<currency code>:<amount>`). Either one alike is the same payment:
 * entered again in a fiat currency, it comes out other sats once the price moved; entered
 * in another unit, it still leaves the wallet as the same amount.
 */
export type RequestedAs = { entered: string; settlement: string }

/**
 * An attempt that threw after dispatch and left nothing its payment could be found by in
 * the wallet's history by what it paid (a send to a Spark or bitcoin address): the key it
 * went out under, if any. A retry under that key is safe, since the SDK refuses it as a
 * duplicate. Under any other key it is safe only once the wallet shows whether the
 * attempt went out: the SDK records a keyed payment with the key as its id, so it is
 * asked for by that id. An attempt that went out without a key cannot be told apart from
 * any other send to the same address, so it is refused until the sender has checked
 * their history. When it was recorded is what lets it lapse across app launches.
 */
export type UnresolvedSend = {
  idempotencyKey?: string
  recordedAtMs?: number
  /** What the sender asked it for. */
  requestedAs?: RequestedAs
}

/** What a send's lost attempts leave behind for the next send to the same destination. */
export type LostAttempts = { lostSend?: LostSend; unresolvedSend?: UnresolvedSend }

/**
 * Lost attempts, by destination, kept across app launches.
 *
 * Not kept on the payment detail: the details screen builds a new one every time it is
 * opened, so a sender who backs out after a lost send and enters the same destination
 * again would start from nothing and could pay it twice. A new amount, wallet or fee is
 * the same destination too, so all of them see what an earlier attempt left behind
 * without carrying it from detail to detail. Not kept in memory alone either: closing the
 * app is the usual answer to a send that hung or threw, and the send made after it would
 * otherwise start from nothing too.
 *
 * Kept apart by wallet: a payment another wallet lost is not this one's to look for, nor
 * to be refused over. Every wallet keeps its own, so one the sender switches back to
 * still has them, and a send still in flight after a switch writes where its own
 * wallet's are, never into the next wallet's.
 */
const lostAttemptsByWallet = new Map<string, Map<string, LostAttempts>>()
/** Until a wallet connects: nothing is sent before one does. */
let connectedWalletAttempts = new Map<string, LostAttempts>()

/** Where a wallet's lost attempts are kept between app launches. */
export type LostAttemptsStorage = {
  load: (walletId: string) => Promise<Map<string, LostAttempts>>
  save: (walletId: string, attempts: ReadonlyMap<string, LostAttempts>) => Promise<void>
}

const deviceStorage: LostAttemptsStorage = {
  load: loadLostAttempts,
  save: saveLostAttempts,
}

/** How long a send waits for the stored attempts; past it, it is refused until they
 *  have been read back. A read that failed twice lets sends go on with this launch's
 *  attempts alone: storage that cannot be read holds back much more than these. */
export const STORED_ATTEMPTS_READ_TIMEOUT_MS = 5000

/**
 * How a wallet's attempts reach storage. `readSettled`: the read of what an earlier launch
 * left, as long as a send waits for it. `isRead`: whether that read has answered. `keep`:
 * stores the attempts as they are now, after every write before it. `forget`: writes
 * nothing more, as the wallet's deletion asks.
 */
type WalletPersistence = {
  readSettled: Promise<void>
  isRead: () => boolean
  keep: () => void
  forget: () => void
}

const persistenceOf = new WeakMap<Map<string, LostAttempts>, WalletPersistence>()

/**
 * Bech32 and bech32m, the encoding of invoices, Spark addresses, segwit bitcoin addresses
 * and bech32 LNURLs: a human-readable part, the separator 1, then data drawn from a
 * 32-character alphabet, all in one case. The case carries no meaning, and a QR code
 * often carries them upper case.
 */
const BECH32 = /^[a-z0-9]+1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/

/**
 * The destination as the store knows it. A bech32 destination pasted lower case and
 * scanned upper case is one, so it is lowercased. Nothing else is: a base58 address, a
 * URL path or a Lightning address user can name another recipient in another case, and
 * two recipients merged into one would let a payment to the first be reported as a send
 * to the second.
 */
const storeKeyOf = (destination: string): string => {
  const trimmed = destination.trim()
  const lower = trimmed.toLowerCase()
  const isOneCase = trimmed === lower || trimmed === trimmed.toUpperCase()
  return isOneCase && BECH32.test(lower) ? lower : trimmed
}

/**
 * Points the store at the wallet now connected, with whatever it holds for it. The first
 * time a wallet connects in this app launch, what it left in storage is read back; its
 * sends wait for that, so none goes out before the attempts an earlier launch lost.
 */
export const scopeLostAttemptsTo = (
  walletId: string,
  storage: LostAttemptsStorage = deviceStorage,
) => {
  const known = lostAttemptsByWallet.get(walletId)
  if (known) {
    connectedWalletAttempts = known
    return
  }

  const held = new Map<string, LostAttempts>()
  lostAttemptsByWallet.set(walletId, held)
  connectedWalletAttempts = held

  persistenceOf.set(held, persistWalletAttempts(walletId, held, storage))
}

/**
 * Forgets a wallet's lost attempts, as its deletion does: nothing of it is written again,
 * a send still in flight for it included, and a later scope to it starts from nothing.
 */
export const forgetLostAttemptsOf = (walletId: string) => {
  const held = lostAttemptsByWallet.get(walletId)
  if (held) persistenceOf.get(held)?.forget()
  lostAttemptsByWallet.delete(walletId)
}

const noop = () => undefined

/**
 * How a wallet's attempts are read back and kept between app launches.
 *
 * Read once the wallet connects. Sends wait for the read only so long, then are refused
 * until it has answered: one that never answers must not hold a send pending for good.
 *
 * Writes wait for the read whatever it takes: until it answers, nothing is known of what
 * an earlier launch kept, and a write would replace it with this launch's attempts alone.
 * A read that failed is tried once more; if that fails too, nothing is written this
 * launch, for the same reason, and the attempts are kept in memory only. Writes queue
 * behind each other, and each writes the attempts as they are when its turn comes, so
 * the last one stored is the latest state. A write that fails leaves the queue going: the
 * storage reports it.
 */
const persistWalletAttempts = (
  walletId: string,
  held: Map<string, LostAttempts>,
  storage: LostAttemptsStorage,
): WalletPersistence => {
  let isReadable = true
  let hasReadAnswered = false
  let isForgotten = false
  /** Nothing is recorded before the read has answered, since no send goes out before. */
  const restore = (stored: Map<string, LostAttempts>) =>
    stored.forEach((attempts, destination) => {
      if (!held.has(destination)) held.set(destination, attempts)
    })

  const readBack: Promise<void> = storage
    .load(walletId)
    .then(restore, () =>
      storage.load(walletId).then(restore, () => {
        isReadable = false
      }),
    )
    .finally(() => {
      hasReadAnswered = true
    })
  const readSettled = withTimeout(
    readBack,
    STORED_ATTEMPTS_READ_TIMEOUT_MS,
    "Lost attempts read",
  ).then(noop, noop)

  const write = async () => {
    const mayWrite = isReadable && !isForgotten
    if (!mayWrite) return
    await storage.save(walletId, new Map(held))
  }

  let lastWrite: Promise<void> = readBack.catch(noop)
  return {
    readSettled,
    isRead: () => hasReadAnswered,
    keep: () => {
      lastWrite = lastWrite.then(write).catch(noop)
    },
    forget: () => {
      isForgotten = true
    },
  }
}

/**
 * The send to each destination in flight, by wallet: what the next send to it waits for.
 * Kept beside the wallet's lost attempts, so a wallet switch neither waits on nor
 * releases another wallet's sends.
 */
const sendsInFlight = new WeakMap<Map<string, LostAttempts>, Map<string, Promise<void>>>()

const sendsInFlightIn = (byDestination: Map<string, LostAttempts>) => {
  const held = sendsInFlight.get(byDestination) ?? new Map<string, Promise<void>>()
  sendsInFlight.set(byDestination, held)
  return held
}

/**
 * Each send still queued or in flight, by destination and the send it is (its payment's
 * idempotency key), by wallet: what a repeat of the same send joins.
 */
const sameSends = new WeakMap<Map<string, LostAttempts>, Map<string, Promise<unknown>>>()

const sameSendsIn = (byDestination: Map<string, LostAttempts>) => {
  const held = sameSends.get(byDestination) ?? new Map<string, Promise<unknown>>()
  sameSends.set(byDestination, held)
  return held
}

/** One destination's lost attempts, in the wallet that was connected when it was taken. */
export type LostAttemptsHandle = {
  read: () => LostAttempts
  /** Whether the attempts an earlier launch left have been read back: until then, what
   *  `read` answers may be missing some. */
  isStoredRead: () => boolean
  /** Applied to what the destination holds when it is written, not when it was read. */
  update: (change: (current: LostAttempts) => LostAttempts) => void
  /**
   * Runs a send once every earlier send to the destination has finished, however it
   * finished. One at a time, each send reads what the one before it left behind and
   * settles only what it made itself: two in flight at once could each act on the
   * other's attempts, and pay one of them twice.
   *
   * A repeat of a send still queued or in flight (`sameSendKey`, a double tap the screen
   * did not stop in time) joins it and answers with its outcome, instead of queueing
   * behind it: a send with a token leg carries no key the SDK could refuse a duplicate
   * by, so the repeat would go out as a second payment once the first succeeded.
   */
  oneAtATime: <T>(send: () => Promise<T>, sameSendKey?: string) => Promise<T>
}

export const lostAttemptsFor = (destination: string): LostAttemptsHandle => {
  const byDestination = connectedWalletAttempts
  const key = storeKeyOf(destination)
  const read = () => byDestination.get(key) ?? {}

  const queueBehindEarlierSends = <T>(send: () => Promise<T>): Promise<T> => {
    const inFlight = sendsInFlightIn(byDestination)
    const turn =
      inFlight.get(key) ??
      persistenceOf.get(byDestination)?.readSettled ??
      Promise.resolve()
    const result = turn.then(send)
    const done = result.then(
      () => undefined,
      () => undefined,
    )
    inFlight.set(key, done)
    done.then(() => {
      if (inFlight.get(key) === done) inFlight.delete(key)
    })
    return result
  }

  return {
    read,
    isStoredRead: () => persistenceOf.get(byDestination)?.isRead() ?? true,
    update: (change) => {
      const next = change(read())
      if (next.lostSend || next.unresolvedSend) byDestination.set(key, next)
      else byDestination.delete(key)
      persistenceOf.get(byDestination)?.keep()
    },
    oneAtATime: (send, sameSendKey) => {
      if (sameSendKey === undefined) return queueBehindEarlierSends(send)

      const pending = sameSendsIn(byDestination)
      const sendKey = `${key}\n${sameSendKey}`
      const joined = pending.get(sendKey)
      if (joined) return joined as ReturnType<typeof send>

      const result = queueBehindEarlierSends(send)
      pending.set(sendKey, result)
      const forget = () => {
        if (pending.get(sendKey) === result) pending.delete(sendKey)
      }
      result.then(forget, forget)
      return result
    },
  }
}

/**
 * The manual conversions' attempt ref, by wallet, for as long as the app runs. Not kept
 * on the conversion screen, for the reason lost sends are not kept on the payment detail:
 * the screen is built anew each time it is opened, so a user who backs out after a lost
 * conversion and opens it again would start from nothing and could convert twice.
 */
const conversionAttemptRefs = new WeakMap<Map<string, LostAttempts>, ConvertAttemptRef>()

export const conversionAttemptRef = (): ConvertAttemptRef => {
  const held = conversionAttemptRefs.get(connectedWalletAttempts) ?? {}
  conversionAttemptRefs.set(connectedWalletAttempts, held)
  return held
}

/** What the connected wallet holds for a destination. */
export const lostAttemptsTo = (destination: string): LostAttempts =>
  lostAttemptsFor(destination).read()

/**
 * The unresolved attempts the sender chose to send anyway past, each for the one send to
 * its destination that comes next. Not the attempt itself: it stays until a send in its
 * place goes out, so one that fails before it does, or an app closed in between, leaves
 * it to be asked about again. In memory alone for the same reason.
 */
const sendAnywayGrants = new WeakSet<UnresolvedSend>()

/** Lets the next send to the attempt's destination go out past it, once. */
export const grantSendAnyway = (unresolved: UnresolvedSend) => {
  sendAnywayGrants.add(unresolved)
}

/** Whether a send may go out past the attempt, taking the grant if so: whatever becomes
 *  of the send, the one after it asks again. */
export const takeSendAnyway = (unresolved: UnresolvedSend | undefined): boolean =>
  unresolved !== undefined && sendAnywayGrants.delete(unresolved)

/**
 * What is left of a destination's lost attempts once a send has accounted for some: the
 * lost attempts it looked for or retried under their own key, and an unresolved attempt
 * under the key it went out with. Anything else stays.
 */
export type SettledAttempts = { lostSend?: LostSend; unresolvedSend?: UnresolvedSend }

export const withoutSettled = (
  current: LostAttempts,
  settled: SettledAttempts,
): LostAttempts => {
  const lostSend =
    current.lostSend && settled.lostSend
      ? withoutIdentities(current.lostSend, settled.lostSend)
      : current.lostSend
  const unresolvedSend =
    current.unresolvedSend && current.unresolvedSend === settled.unresolvedSend
      ? undefined
      : current.unresolvedSend
  return { lostSend, unresolvedSend }
}

const withoutIdentities = (lost: LostSend, settled: LostSend): LostSend | undefined => {
  const paymentHashes = lost.paymentHashes.filter(
    (h) => !settled.paymentHashes.includes(h),
  )
  const sparkInvoices = lost.sparkInvoices.filter(
    (i) => !settled.sparkInvoices.includes(i),
  )
  if (paymentHashes.length === 0 && sparkInvoices.length === 0) return undefined
  return {
    ...lost,
    paymentHashes,
    sparkInvoices,
    requestedAs: requestsStillLost(lost.requestedAs, paymentHashes, sparkInvoices),
  }
}

/** What the attempts still lost were asked for, and nothing of the ones settled. */
const requestsStillLost = (
  requestedAs: Record<string, RequestedAs> | undefined,
  paymentHashes: ReadonlyArray<string>,
  sparkInvoices: ReadonlyArray<string>,
): Record<string, RequestedAs> | undefined => {
  if (!requestedAs) return undefined
  const remaining = new Set([
    ...paymentHashes.map((hash) => `hash:${hash}`),
    ...sparkInvoices.map((invoice) => `invoice:${invoice}`),
  ])
  return Object.fromEntries(
    Object.entries(requestedAs).filter(([identity]) => remaining.has(identity)),
  )
}
