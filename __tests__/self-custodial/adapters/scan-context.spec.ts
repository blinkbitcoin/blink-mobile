import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { createSelfCustodialScanContext } from "@app/self-custodial/adapters/scan-context"
import { type WalletState, toWalletId } from "@app/types/wallet"

const buildWallet = (id: string): WalletState => ({
  id: toWalletId(id),
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
})

describe("createSelfCustodialScanContext", () => {
  it("maps wallet ids from the active self-custodial wallets", () => {
    const adapter = createSelfCustodialScanContext(
      [buildWallet("self-custodial-btc"), buildWallet("self-custodial-usd")],
      Network.Mainnet,
    )

    expect(adapter.myWalletIds).toEqual(["self-custodial-btc", "self-custodial-usd"])
  })

  it("maps the Breez network to its label", () => {
    expect(createSelfCustodialScanContext([], Network.Mainnet).bitcoinNetwork).toBe(
      "mainnet",
    )
    expect(createSelfCustodialScanContext([], Network.Regtest).bitcoinNetwork).toBe(
      "regtest",
    )
  })

  it("returns an empty wallet id list when no wallets are connected", () => {
    expect(createSelfCustodialScanContext([], Network.Mainnet).myWalletIds).toEqual([])
  })

  it("returns an empty lnurlDomains list (intraledger lookup is disabled in self-custodial)", () => {
    expect(createSelfCustodialScanContext([], Network.Mainnet).lnurlDomains).toEqual([])
  })
})
