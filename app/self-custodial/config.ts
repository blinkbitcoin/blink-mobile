import Config from "react-native-config"
import { DocumentDirectoryPath } from "react-native-fs"

export const SparkToken = {
  Label: "USDB",
  Ticker: "USDB",
} as const

export type SparkToken = (typeof SparkToken)[keyof typeof SparkToken]

export const SparkConfig = {
  storageDir: `${DocumentDirectoryPath}/breez-sdk-spark`,
  maxSlippageBps: 50,
  tokenIdentifier: Config.SPARK_TOKEN_IDENTIFIER ?? "",
  apiKey: Config.BREEZ_API_KEY ?? "",
} as const
