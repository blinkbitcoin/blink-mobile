import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { type GaloyInstanceName } from "@app/config"

import {
  sparkNetworkFromGaloyInstanceId,
  sparkNetworkLabelFromGaloyInstanceId,
  storageDirFor,
  type SparkNetworkLabel,
} from "../config"
import { type ParsedSparkAddress, parseSparkAddress } from "./parse"
import {
  initSdk,
  selfCustodialCreateWallet,
  selfCustodialRestoreWallet,
} from "./lifecycle"
import { validateStoredNetwork } from "../providers/validate-network"

export type SelfCustodialBridge = {
  sparkNetworkLabel: SparkNetworkLabel
  initSdk: (mnemonic: string, accountId: string) => Promise<BreezSdkInterface>
  validateStoredNetwork: (accountId: string) => Promise<boolean>
  selfCustodialCreateWallet: (accountId: string) => Promise<void>
  selfCustodialRestoreWallet: (accountId: string, mnemonic: string) => Promise<void>
  parseSparkAddress: (
    sdk: BreezSdkInterface,
    input: string,
  ) => Promise<ParsedSparkAddress | null>
  storageDirForAccount: (accountId: string) => string
}

export const createSelfCustodialBridge = (
  galoyInstanceId: GaloyInstanceName,
): SelfCustodialBridge => {
  const sparkNetwork = sparkNetworkFromGaloyInstanceId(galoyInstanceId)
  const sparkNetworkLabel = sparkNetworkLabelFromGaloyInstanceId(galoyInstanceId)

  const storageDirForAccount = (accountId: string): string =>
    storageDirFor(sparkNetworkLabel, accountId)

  return {
    sparkNetworkLabel,
    initSdk: (mnemonic: string, accountId: string) =>
      initSdk(mnemonic, storageDirForAccount(accountId), sparkNetwork),
    validateStoredNetwork: (accountId: string) =>
      validateStoredNetwork(accountId, sparkNetworkLabel),
    selfCustodialCreateWallet: (accountId: string) =>
      selfCustodialCreateWallet(accountId, sparkNetworkLabel),
    selfCustodialRestoreWallet: (accountId: string, mnemonic: string) =>
      selfCustodialRestoreWallet({
        accountId,
        mnemonic,
        network: sparkNetwork,
        storageDir: storageDirForAccount(accountId),
      }),
    parseSparkAddress: (sdk: BreezSdkInterface, input: string) =>
      parseSparkAddress(sdk, input, sparkNetwork),
    storageDirForAccount,
  }
}
