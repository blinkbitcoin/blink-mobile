import { Network } from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"
import { DocumentDirectoryPath } from "react-native-fs"

export const SparkToken = {
  Label: "USDB",
  Ticker: "USDB",
} as const

export type SparkToken = (typeof SparkToken)[keyof typeof SparkToken]

const NETWORK_MAP: Record<string, Network> = {
  mainnet: Network.Mainnet,
  regtest: Network.Regtest,
}

const parseNetwork = (): Network => {
  const raw = Config.BREEZ_NETWORK?.toLowerCase()
  if (!raw) return Network.Mainnet
  const network = NETWORK_MAP[raw]
  if (network === undefined) {
    throw new Error(`Unknown BREEZ_NETWORK: "${raw}". Expected: mainnet, regtest`)
  }
  return network
}

export const SparkNetwork = parseNetwork()

const networkSuffix = SparkNetwork === Network.Mainnet ? "mainnet" : "regtest"

export const SparkConfig = {
  network: SparkNetwork,
  storageDir: `${DocumentDirectoryPath}/breez-sdk-spark-${networkSuffix}`,
  maxSlippageBps: 50,
  tokenIdentifier: Config.SPARK_TOKEN_IDENTIFIER ?? "",
  apiKey: Config.BREEZ_API_KEY ?? "",
} as const
