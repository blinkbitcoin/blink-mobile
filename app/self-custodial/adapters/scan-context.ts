import { type Network } from "@breeztech/breez-sdk-spark-react-native"

import { type ScanContextAdapter } from "@app/types/scan-context"
import { type WalletState } from "@app/types/wallet"

import { networkLabelFor } from "../config"

export const createSelfCustodialScanContext = (
  wallets: ReadonlyArray<WalletState>,
  network: Network,
): ScanContextAdapter => ({
  myWalletIds: wallets.map((wallet) => wallet.id),
  bitcoinNetwork: networkLabelFor(network),
  lnurlDomains: [],
})
