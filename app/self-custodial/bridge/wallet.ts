import {
  PaymentType,
  RegisterLightningAddressRequest,
  SyncWalletRequest,
  defaultExternalSigners,
  type BreezSdkInterface,
  type Network,
  type Payment,
  type SyncWalletResponse,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"

/** defaultExternalSigners is typed with the bare signer interfaces, which omit the
 *  uniffi lifecycle method, though the concrete objects always carry it. */
type DisposableSigner = { uniffiDestroy: () => void }

/** Both destroys run from a finally, where a throw would strand the signer that has not
 *  been freed yet and replace the pubkey (or the original error) on the way out. */
const destroySigner = (signer: object) => {
  try {
    ;(signer as DisposableSigner).uniffiDestroy()
  } catch (err) {
    /** Already freed, or a binding that no longer carries the uniffi lifecycle method.
     *  Reported rather than swallowed: the second case leaves the seed-derived key material
     *  resident in native memory until GC, which is what this call exists to prevent. */
    reportError("destroySigner", err)
  }
}

export const getWalletInfo = (sdk: BreezSdkInterface) =>
  sdk.getInfo({ ensureSynced: false })

/**
 * Derives the wallet identity pubkey from the mnemonic without a connected SDK, matching
 * getWalletInfo().identityPubkey so the account is identifiable before the SDK connects.
 */
export const deriveWalletIdentityPubkey = async (
  mnemonic: string,
  network: Network,
): Promise<string> => {
  const { breezSigner, sparkSigner } = defaultExternalSigners(
    mnemonic,
    undefined,
    network,
    undefined,
  )
  /** The signers hold key material derived from the seed in native memory; free both as
   *  soon as the pubkey is read instead of waiting for GC to run the destructor guards. */
  try {
    const { bytes } = await sparkSigner.getIdentityPublicKey()
    return Buffer.from(new Uint8Array(bytes)).toString("hex")
  } finally {
    destroySigner(breezSigner)
    destroySigner(sparkSigner)
  }
}

/** The sync each wallet has in flight, so callers share it rather than each starting one.
 *  Keyed by the SDK itself, so a wallet that is replaced — another account, a reconnect —
 *  starts clean and the entry for the old one goes with it. */
const inFlightSync = new WeakMap<BreezSdkInterface, Promise<SyncWalletResponse>>()

/**
 * Never cancelled, deliberately. The SDK's async option would carry an `AbortSignal`
 * through to UniFFI's future cancellation, but a user sync is run by the caller's own
 * future: `trigger_sync_and_wait` marks the coordinator `sync_running` and then awaits
 * `run_sync_loop` inline, and that flag is cleared only where the loop drains its waiters
 * (`sdk/sync_coordinator.rs` @0.23.1, unchanged at 0.27.1). Cancelling drops the loop
 * with the flag still set, so every later sync queues behind a runner that no longer
 * exists and waits forever, for as long as the wallet is connected.
 *
 * Which means a caller that gives up still leaves the call running, so a second caller
 * arriving meanwhile is handed the first one instead of starting another. Nothing is lost
 * by waiting on it: a sync that is already running is the catch-up a new one would ask
 * for, and the SDK would serialize them anyway — the coordinator queues a later caller
 * behind the same pass, and `collect_exit_chains` has it join the collection already in
 * progress. What a second call would add is another uncancellable native future and,
 * where the stall is in the collection rather than the pass, another full sync on a
 * connection already struggling.
 *
 * Sharing lasts only as long as the call does: once it settles the entry is dropped, so
 * the next caller gets a sync of its own.
 */
export const syncSelfCustodialWallet = (
  sdk: BreezSdkInterface,
): Promise<SyncWalletResponse> => {
  const running = inFlightSync.get(sdk)
  if (running) return running

  const started = sdk.syncWallet(SyncWalletRequest.create({}))
  inFlightSync.set(sdk, started)
  /**
   * Dropped on either ending, since a sync that failed is as finished as one that did
   * not, and the next caller is owed a new one rather than this one's error.
   *
   * No guard that the entry is still this call's: it cannot be another's. The entry is
   * set in the same breath as the call, and the only thing that removes it is this
   * handler, so a later call finds this one and shares it until then. The handlers sit on
   * a branch of their own, which leaves what callers await untouched — both its timing
   * and its rejection, which stays theirs to handle.
   */
  const clear = () => inFlightSync.delete(sdk)
  started.then(clear, clear)
  return started
}

export const listPayments = (sdk: BreezSdkInterface, offset: number, limit: number) =>
  sdk.listPayments({
    typeFilter: undefined,
    statusFilter: undefined,
    assetFilter: undefined,
    paymentDetailsFilter: undefined,
    fromTimestamp: undefined,
    toTimestamp: undefined,
    offset,
    limit,
    sortAscending: false,
  })

/** One page of the outgoing payments created at or after `fromTimestamp` (unix seconds),
 *  newest first, in any status: what a send whose outcome the SDK lost is looked up
 *  against. */
export const listSentPaymentsSince = (
  sdk: BreezSdkInterface,
  {
    fromTimestamp,
    limit,
    offset,
  }: { fromTimestamp: bigint; limit: number; offset: number },
) =>
  sdk.listPayments({
    typeFilter: [PaymentType.Send],
    statusFilter: undefined,
    assetFilter: undefined,
    paymentDetailsFilter: undefined,
    fromTimestamp,
    toTimestamp: undefined,
    offset,
    limit,
    sortAscending: false,
  })

const EXPORT_PAGE_SIZE = 100
/** 500 pages × 100 payments: far beyond any real wallet, so hitting it means the SDK
 *  stopped shortening pages and the loop would otherwise never terminate. */
const EXPORT_MAX_PAGES = 500

/**
 * Pages through the complete payment history for export use cases. The UI's paged
 * state only holds what the user has scrolled to, so exports fetch independently.
 * Newest-first ordering means a payment arriving mid-loop shifts offsets and can
 * repeat a boundary payment on the next page; dedupe by id keeps the result clean.
 */
export const listAllPayments = async (
  sdk: BreezSdkInterface,
  pageSize: number = EXPORT_PAGE_SIZE,
): Promise<Payment[]> => {
  const byId = new Map<string, Payment>()
  for (let page = 0; page < EXPORT_MAX_PAGES; page += 1) {
    const { payments } = await listPayments(sdk, page * pageSize, pageSize)
    for (const payment of payments) byId.set(payment.id, payment)
    if (payments.length < pageSize) return [...byId.values()]
  }
  throw new Error(
    `listAllPayments aborted after ${EXPORT_MAX_PAGES} pages of ${pageSize} payments`,
  )
}

export const getUserSettings = (sdk: BreezSdkInterface) => sdk.getUserSettings()

export const getLightningAddress = (sdk: BreezSdkInterface) => sdk.getLightningAddress()

export const checkLightningAddressAvailable = (
  sdk: BreezSdkInterface,
  username: string,
) => sdk.checkLightningAddressAvailable({ username })

export const registerLightningAddress = (sdk: BreezSdkInterface, username: string) =>
  sdk.registerLightningAddress(RegisterLightningAddressRequest.create({ username }))
