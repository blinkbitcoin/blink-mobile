import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { openExternalUrl } from "@app/utils/external"

const mempoolBaseUrl = (network: Network): string =>
  network === Network.Mainnet
    ? "https://mempool.space/tx/"
    : "https://mempool.space/testnet/tx/"

export const openMempoolTx = (txid: string, network: Network): void => {
  openExternalUrl(`${mempoolBaseUrl(network)}${txid}`)
}

export const addressPlaceholderFor = (network: Network): string =>
  network === Network.Mainnet ? "bc1q..." : "bcrt1q..."
