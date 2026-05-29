import { type ScanContextAdapter } from "@app/types/scan-context"
import { type WalletState } from "@app/types/wallet"

import { type SparkNetworkLabel } from "../config"

export const createSelfCustodialScanContext = (
  wallets: ReadonlyArray<WalletState>,
  networkLabel: SparkNetworkLabel,
): ScanContextAdapter => ({
  myWalletIds: wallets.map((wallet) => wallet.id),
  bitcoinNetwork: networkLabel,
  lnurlDomains: [],
})
