import {
  type BreezSdkInterface,
  type GetInfoResponse,
  type TokenBalance,
} from "@breeztech/breez-sdk-spark-react-native"

import { requireSparkTokenIdentifier, SparkToken } from "../config"
import { recordErrorOnce } from "../logging"

const listTokenBalances = (info: GetInfoResponse): TokenBalance[] =>
  info.tokenBalances instanceof Map
    ? [...info.tokenBalances.values()]
    : Object.values(info.tokenBalances ?? {})

export const findUsdbToken = (info: GetInfoResponse): TokenBalance | undefined => {
  const expectedIdentifier = requireSparkTokenIdentifier()
  const match = listTokenBalances(info).find(
    (token) => token.tokenMetadata?.identifier === expectedIdentifier,
  )
  if (!match) {
    recordErrorOnce(
      `spark-token-not-found:${expectedIdentifier}`,
      new Error(
        `Spark token ${expectedIdentifier} not present in tokenBalances response`,
      ),
    )
  }
  return match
}

export const fetchUsdbDecimals = async (sdk: BreezSdkInterface): Promise<number> => {
  const info = await sdk.getInfo({ ensureSynced: false })
  const decimals = findUsdbToken(info)?.tokenMetadata?.decimals
  if (decimals === undefined) {
    recordErrorOnce(
      "spark-token-decimals-missing",
      new Error(
        `Spark token decimals unavailable; falling back to ${SparkToken.DefaultDecimals}`,
      ),
    )
    return SparkToken.DefaultDecimals
  }
  return decimals
}
