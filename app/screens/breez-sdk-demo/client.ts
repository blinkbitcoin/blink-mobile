import {
  connect,
  defaultConfig,
  type BreezSdkInterface,
  Network,
  Seed,
} from "@breeztech/breez-sdk-spark-react-native"
import { DocumentDirectoryPath } from "react-native-fs"
import Config from "react-native-config"

const STORAGE_DIR = `${DocumentDirectoryPath}/breez-sdk-demo`
const MNEMONIC = ""

let sdkInstance: BreezSdkInterface | null = null
let connecting: Promise<BreezSdkInterface> | null = null

export const getBreezClient = async (): Promise<BreezSdkInterface> => {
  if (sdkInstance) return sdkInstance
  if (connecting) return connecting

  connecting = (async () => {
    const seed = new Seed.Mnemonic({ mnemonic: MNEMONIC, passphrase: undefined })
    const config = defaultConfig(Network.Mainnet)
    config.apiKey = Config.BREEZ_API_KEY ?? ""
    config.stableBalanceConfig = {
      tokens: [
        {
          label: "USDB",
          tokenIdentifier: Config.SPARK_TOKEN_IDENTIFIER ?? "",
        },
      ],
      defaultActiveLabel: undefined,
      thresholdSats: undefined,
      maxSlippageBps: undefined,
    }

    const sdk = await connect({ config, seed, storageDir: STORAGE_DIR })
    sdkInstance = sdk
    connecting = null
    return sdk
  })()

  return connecting
}

export const disconnectBreezClient = async (): Promise<void> => {
  if (!sdkInstance) return
  const instance = sdkInstance
  sdkInstance = null
  connecting = null
  await instance.disconnect()
}
