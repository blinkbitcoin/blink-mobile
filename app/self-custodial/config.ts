import { Network } from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"
import { DocumentDirectoryPath } from "react-native-fs"

export const SparkToken = {
  Label: "USDB",
  DefaultDecimals: 6,
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

export const SparkNetworkLabel = SparkNetwork === Network.Mainnet ? "mainnet" : "regtest"

export const SparkConfig = {
  network: SparkNetwork,
  storageDir: `${DocumentDirectoryPath}/breez-sdk-spark-${SparkNetworkLabel}`,
  maxSlippageBps: 50,
  apiKey: Config.BREEZ_API_KEY ?? "",
} as const

export const requireSparkTokenIdentifier = (): string => {
  const id = Config.SPARK_TOKEN_IDENTIFIER
  if (!id) {
    throw new Error("SPARK_TOKEN_IDENTIFIER is not configured for this build")
  }
  return id
}
