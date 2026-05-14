import { LNURL_DOMAINS } from "@app/config"
import { type Network, type ScanningQrCodeScreenQuery } from "@app/graphql/generated"
import { type ScanContextAdapter } from "@app/types/scan-context"

export const createCustodialScanContext = (
  data: ScanningQrCodeScreenQuery | undefined,
  fallbackNetwork: Network | null,
  lnAddressHostname: string,
): ScanContextAdapter => ({
  myWalletIds: data?.me?.defaultAccount.wallets.map((wallet) => wallet.id) ?? [],
  bitcoinNetwork: data?.globals?.network ?? fallbackNetwork,
  lnurlDomains: [lnAddressHostname, ...LNURL_DOMAINS],
})
