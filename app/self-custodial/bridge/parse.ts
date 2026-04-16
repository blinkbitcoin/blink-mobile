import {
  BitcoinNetwork,
  InputType_Tags as InputTag,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { SparkConfig } from "../config"

export type ParsedSparkAddress = {
  address: string
  identityPublicKey: string
  networkMatch: boolean
}

const NETWORK_MAP: Record<number, BitcoinNetwork> = {
  0: BitcoinNetwork.Bitcoin,
  1: BitcoinNetwork.Regtest,
}

export const parseSparkAddress = async (
  sdk: BreezSdkInterface,
  input: string,
): Promise<ParsedSparkAddress | null> => {
  try {
    const parsed = await sdk.parse(input.trim())
    if (parsed.tag !== InputTag.SparkAddress) return null

    const [details] = parsed.inner
    const expectedNetwork = NETWORK_MAP[SparkConfig.network]

    return {
      address: details.address,
      identityPublicKey: details.identityPublicKey,
      networkMatch: details.network === expectedNetwork,
    }
  } catch {
    return null
  }
}
