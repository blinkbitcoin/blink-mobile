import { type ScanContextAdapter } from "@app/types/scan-context"
import { type WalletState } from "@app/types/wallet.types"

import { SparkNetworkLabel } from "../config"

export const createSelfCustodialScanContext = (
  wallets: ReadonlyArray<WalletState>,
): ScanContextAdapter => ({
  myWalletIds: wallets.map((wallet) => wallet.id),
  bitcoinNetwork: SparkNetworkLabel,
  lnurlDomains: [],
})
