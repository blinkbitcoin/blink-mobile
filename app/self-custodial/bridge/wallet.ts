import {
  RegisterLightningAddressRequest,
  SyncWalletRequest,
  defaultExternalSigners,
  type BreezSdkInterface,
  type Network,
  type Payment,
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

export const syncSelfCustodialWallet = (sdk: BreezSdkInterface) =>
  sdk.syncWallet(SyncWalletRequest.create({}))

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
