import {
  RegisterLightningAddressRequest,
  SyncWalletRequest,
  defaultExternalSigner,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { SparkConfig } from "../config"

export const getWalletInfo = (sdk: BreezSdkInterface) =>
  sdk.getInfo({ ensureSynced: false })

/**
 * Derives the wallet identity pubkey from the mnemonic without a connected SDK, matching
 * getWalletInfo().identityPubkey so the account is identifiable before the SDK connects.
 */
export const deriveWalletIdentityPubkey = (mnemonic: string): string => {
  const signer = defaultExternalSigner(
    mnemonic,
    undefined,
    SparkConfig.network,
    undefined,
  )
  const { bytes } = signer.identityPublicKey()
  return Buffer.from(new Uint8Array(bytes)).toString("hex")
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
