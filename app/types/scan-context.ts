import { type Network } from "@app/graphql/generated"

export type ScanContextAdapter = {
  myWalletIds: string[]
  bitcoinNetwork: Network | null
  lnurlDomains: string[]
}
