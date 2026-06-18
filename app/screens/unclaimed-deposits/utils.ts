import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { SparkNetwork } from "@app/self-custodial/config"
import { openExternalUrl } from "@app/utils/external"

const MEMPOOL_BASE_URL =
  SparkNetwork === Network.Mainnet
    ? "https://mempool.space/tx/"
    : "https://mempool.space/testnet/tx/"

export const openMempoolTx = (txid: string): void => {
  openExternalUrl(`${MEMPOOL_BASE_URL}${txid}`)
}

export const ADDRESS_PLACEHOLDER =
  SparkNetwork === Network.Mainnet ? "bc1q..." : "bcrt1q..."
