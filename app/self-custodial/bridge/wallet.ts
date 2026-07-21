import {
  RegisterLightningAddressRequest,
  SyncWalletRequest,
  defaultExternalSigner,
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

/** defaultExternalSigner is typed as the bare ExternalSigner interface, which omits the
 *  uniffi lifecycle method, though the concrete object always carries it. */
type DisposableSigner = { uniffiDestroy: () => void }

export const getWalletInfo = (sdk: BreezSdkInterface) =>
  sdk.getInfo({ ensureSynced: false })

/**
 * Derives the wallet identity pubkey from the mnemonic without a connected SDK, matching
 * getWalletInfo().identityPubkey so the account is identifiable before the SDK connects.
 */
export const deriveWalletIdentityPubkey = (
  mnemonic: string,
  network: Network,
): string => {
  const signer = defaultExternalSigner(mnemonic, undefined, network, undefined)
  /** The signer holds key material derived from the seed in native memory; free it as soon
   *  as the pubkey is read instead of waiting for GC to run the destructor guard. */
  try {
    const { bytes } = signer.identityPublicKey()
    return Buffer.from(new Uint8Array(bytes)).toString("hex")
  } finally {
    const disposableSigner = signer as unknown as DisposableSigner
    disposableSigner.uniffiDestroy()
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

export const getUserSettings = (sdk: BreezSdkInterface) => sdk.getUserSettings()

export const getLightningAddress = (sdk: BreezSdkInterface) => sdk.getLightningAddress()

export const checkLightningAddressAvailable = (
  sdk: BreezSdkInterface,
  username: string,
) => sdk.checkLightningAddressAvailable({ username })

export const registerLightningAddress = (sdk: BreezSdkInterface, username: string) =>
  sdk.registerLightningAddress(RegisterLightningAddressRequest.create({ username }))
