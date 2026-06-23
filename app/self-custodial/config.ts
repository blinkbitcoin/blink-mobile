import { Network } from "@breeztech/breez-sdk-spark-react-native"
import Config from "react-native-config"
import { DocumentDirectoryPath } from "react-native-fs"

import { type GaloyInstanceName } from "@app/config/galoy-instances"

export const SparkToken = {
  Label: "USDB",
  DefaultDecimals: 6,
} as const

export type SparkToken = (typeof SparkToken)[keyof typeof SparkToken]

export const MAX_SLIPPAGE_BPS = 50

// Spark bech32 HRPs (spark1/sparkrt1); gates the async sdk.parse, which can hang on some non-Spark bech32 input.
const SPARK_ADDRESS_SHAPE_PATTERN = /^(?:spark1|sparkrt1)/i

export const hasSparkAddressShape = (input: string): boolean =>
  SPARK_ADDRESS_SHAPE_PATTERN.test(input.trim())

export type SparkNetworkLabel = "mainnet" | "regtest"

/**
 * Self-custodial follows the same environment mapping as custodial. Breez only
 * supports mainnet and regtest, so every non-Main instance maps to regtest.
 */
export const networkForInstance = (instanceId: GaloyInstanceName): Network =>
  instanceId === "Main" ? Network.Mainnet : Network.Regtest

export const networkLabelFor = (network: Network): SparkNetworkLabel =>
  network === Network.Mainnet ? "mainnet" : "regtest"

export const isRegtestNetwork = (network: Network): boolean => network === Network.Regtest

const MAINNET_LNURL_DOMAIN = "blink.sv"
const REGTEST_LNURL_DOMAIN = "staging.blink.sv"

export const lnurlDomainFor = (network: Network): string =>
  network === Network.Mainnet ? MAINNET_LNURL_DOMAIN : REGTEST_LNURL_DOMAIN

/**
 * Returns the wallet's stored network label when it conflicts with the current
 * network, or null when there is no stored label or it matches. Single source
 * of the mismatch rule shared by the SDK connect gate and the mismatch toast.
 */
export const mismatchedNetworkLabel = (
  storedLabel: string | null,
  network: Network,
): string | null => {
  if (!storedLabel) return null
  return storedLabel === networkLabelFor(network) ? null : storedLabel
}

export const storageDirFor = (accountId: string, network: Network): string =>
  `${DocumentDirectoryPath}/breez-sdk-spark-${networkLabelFor(network)}/${accountId}`

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
