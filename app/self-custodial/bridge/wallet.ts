import {
  RegisterLightningAddressRequest,
  SyncWalletRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

export const getWalletInfo = (sdk: BreezSdkInterface) =>
  sdk.getInfo({ ensureSynced: false })

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
