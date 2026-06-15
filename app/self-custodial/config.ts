import { Network } from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"
import { DocumentDirectoryPath } from "react-native-fs"

export const SparkToken = {
  Label: "USDB",
  DefaultDecimals: 6,
} as const

export type SparkToken = (typeof SparkToken)[keyof typeof SparkToken]

const SPARK_ADDRESS_SHAPE_PATTERN = /^(?:sp1|sprt1)/i

export const hasSparkAddressShape = (input: string): boolean =>
  SPARK_ADDRESS_SHAPE_PATTERN.test(input.trim())

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
} as const

// Validates BREEZ_API_KEY at SDK init (from `lifecycle.createSdkConfig`). A
// missing key means the build is misconfigured (e.g. release minification
// stripped the react-native-config BuildConfig values); failing loud here
// surfaces that instead of connecting with an empty key and showing a
// misleading "wallet is offline" network error.
export const requireBreezApiKey = (): string => {
  const apiKey = Config.BREEZ_API_KEY
  if (!apiKey) {
    throw new Error("BREEZ_API_KEY is not configured for this build")
  }
  return apiKey
}

let cachedTokenIdentifier: string | null = null

// Validates SPARK_TOKEN_IDENTIFIER once per session. The first call (typically
// from `lifecycle.createSdkConfig` at SDK init) performs the env lookup and
// throws on a misconfigured build; downstream callers in hot paths (mappers,
// snapshot loops, conversion entry points) read the cached value without
// re-validating.
export const requireSparkTokenIdentifier = (): string => {
  if (cachedTokenIdentifier !== null) return cachedTokenIdentifier
  const id = Config.SPARK_TOKEN_IDENTIFIER
  if (!id) {
    throw new Error("SPARK_TOKEN_IDENTIFIER is not configured for this build")
  }
  cachedTokenIdentifier = id
  return id
}

export const storageDirFor = (accountId: string): string =>
  `${SparkConfig.storageDir}/${accountId}`
