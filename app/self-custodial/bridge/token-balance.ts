import {
  type BreezSdkInterface,
  type GetInfoResponse,
  type TokenBalance,
} from "@breeztech/breez-sdk-spark-react-native"

import { SparkConfig, SparkToken } from "../config"

const listTokenBalances = (info: GetInfoResponse): TokenBalance[] =>
  info.tokenBalances instanceof Map
    ? [...info.tokenBalances.values()]
    : Object.values(info.tokenBalances ?? {})

export const findUsdbToken = (info: GetInfoResponse): TokenBalance | undefined =>
  listTokenBalances(info).find(
    (token) => token.tokenMetadata?.identifier === SparkConfig.tokenIdentifier,
  )

export const fetchUsdbDecimals = async (sdk: BreezSdkInterface): Promise<number> => {
  const info = await sdk.getInfo({ ensureSynced: false })
  return findUsdbToken(info)?.tokenMetadata?.decimals ?? SparkToken.DefaultDecimals
}
