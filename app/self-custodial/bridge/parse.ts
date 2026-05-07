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

export const ParseSparkAddressOutcome = {
  Match: "match",
  NotSparkAddress: "not_spark_address",
  ParseError: "parse_error",
} as const

export type ParseSparkAddressOutcome =
  (typeof ParseSparkAddressOutcome)[keyof typeof ParseSparkAddressOutcome]

export type ParseSparkAddressResult =
  | { outcome: typeof ParseSparkAddressOutcome.Match; address: ParsedSparkAddress }
  | { outcome: typeof ParseSparkAddressOutcome.NotSparkAddress }
  | { outcome: typeof ParseSparkAddressOutcome.ParseError; error: unknown }

const NETWORK_MAP: Record<number, BitcoinNetwork> = {
  0: BitcoinNetwork.Bitcoin,
  1: BitcoinNetwork.Regtest,
}

export const parseSparkAddressDetailed = async (
  sdk: BreezSdkInterface,
  input: string,
): Promise<ParseSparkAddressResult> => {
  try {
    const parsed = await sdk.parse(input.trim())
    if (parsed.tag !== InputTag.SparkAddress) {
      return { outcome: ParseSparkAddressOutcome.NotSparkAddress }
    }

    const [details] = parsed.inner
    const expectedNetwork = NETWORK_MAP[SparkConfig.network]

    return {
      outcome: ParseSparkAddressOutcome.Match,
      address: {
        address: details.address,
        identityPublicKey: details.identityPublicKey,
        networkMatch: details.network === expectedNetwork,
      },
    }
  } catch (error) {
    return { outcome: ParseSparkAddressOutcome.ParseError, error }
  }
}

export const parseSparkAddress = async (
  sdk: BreezSdkInterface,
  input: string,
): Promise<ParsedSparkAddress | null> => {
  const result = await parseSparkAddressDetailed(sdk, input)
  return result.outcome === ParseSparkAddressOutcome.Match ? result.address : null
}
