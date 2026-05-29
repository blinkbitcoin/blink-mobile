import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { type GaloyInstanceName } from "@app/config"
import { sparkNetworkFromGaloyInstanceId } from "@app/self-custodial/config"
import { openExternalUrl } from "@app/utils/external"

const mempoolBaseUrlFor = (galoyInstanceId: GaloyInstanceName): string =>
  sparkNetworkFromGaloyInstanceId(galoyInstanceId) === Network.Mainnet
    ? "https://mempool.space/tx/"
    : "https://mempool.space/testnet/tx/"

export const openMempoolTx = (txid: string, galoyInstanceId: GaloyInstanceName): void => {
  openExternalUrl(`${mempoolBaseUrlFor(galoyInstanceId)}${txid}`).catch(() => undefined)
}

export const addressPlaceholder = (galoyInstanceId: GaloyInstanceName): string =>
  sparkNetworkFromGaloyInstanceId(galoyInstanceId) === Network.Mainnet
    ? "bc1q..."
    : "bcrt1q..."
