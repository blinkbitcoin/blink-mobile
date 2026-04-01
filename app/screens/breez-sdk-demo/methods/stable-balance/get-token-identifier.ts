import { defaultConfig, Network } from "@breeztech/breez-sdk-spark-react-native"

export const getDefaultConfig = async () => {
  const config = defaultConfig(Network.Mainnet)
  return {
    stableBalanceConfig: config.stableBalanceConfig,
  }
}
