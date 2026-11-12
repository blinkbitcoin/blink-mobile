/**
 * What sends that threw after dispatch leave behind for the next send to the same
 * destination. No dependencies, so the wallet lifecycle can scope it without pulling in
 * the send path.
 */
import type { ConvertAttemptRef } from "@app/types/payment"

/**
 * The attempts of a send that threw after dispatch without their payment turning up: the
 * payment hash of each invoice they paid (or, for a Spark invoice, the invoice itself),
 * when the first of them was made, and the idempotency key they all went out under, if
 * they shared one. A retry under that key is refused by the SDK as a duplicate, so it
 * needs no look first; any other send does.
 */
export type LostSend = {
  startedAtMs: number
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
 * their history.
 */
export type UnresolvedSend = {
  idempotencyKey?: string
  /** What the sender asked it for. */
  requestedAs?: RequestedAs
}

/** What a send's lost attempts leave behind for the next send to the same destination. */
export type LostAttempts = { lostSend?: LostSend; unresolvedSend?: UnresolvedSend }

/**
 * Lost attempts, by destination, for as long as the app runs.
 *
 * Not kept on the payment detail: the details screen builds a new one every time it is
 * opened, so a sender who backs out after a lost send and enters the same destination
 * again would start from nothing and could pay it twice. A new amount, wallet or fee is
 * the same destination too, so all of them see what an earlier attempt left behind
 * without carrying it from detail to detail.
 *
 * Kept apart by wallet: a payment another wallet lost is not this one's to look for, nor
 * to be refused over. Every wallet keeps its own for as long as the app runs, so one the
 * sender switches back to still has them, and a send still in flight after a switch
 * writes where its own wallet's are, never into the next wallet's.
 */
const lostAttemptsByWallet = new Map<string, Map<string, LostAttempts>>()
/** Until a wallet connects: nothing is sent before one does. */
let connectedWalletAttempts = new Map<string, LostAttempts>()

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

/** Points the store at the wallet now connected, with whatever it holds for it. */
export const scopeLostAttemptsTo = (walletId: string) => {
  const held = lostAttemptsByWallet.get(walletId) ?? new Map<string, LostAttempts>()
  lostAttemptsByWallet.set(walletId, held)
  connectedWalletAttempts = held
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
    const result = (inFlight.get(key) ?? Promise.resolve()).then(send)
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
    update: (change) => {
      const next = change(read())
      if (next.lostSend || next.unresolvedSend) byDestination.set(key, next)
      else byDestination.delete(key)
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
