import { Network as GaloyNetwork, WalletCurrency } from "@app/graphql/generated"
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
      "mainnet",
    )

    expect(adapter.myWalletIds).toEqual(["self-custodial-btc", "self-custodial-usd"])
  })

  it("returns bitcoinNetwork equal to the provided network label", () => {
    const adapter = createSelfCustodialScanContext([], "mainnet")

    expect(adapter.bitcoinNetwork).toBe(GaloyNetwork.Mainnet)
  })

  it("returns an empty wallet id list when no wallets are connected", () => {
    const adapter = createSelfCustodialScanContext([], "mainnet")

    expect(adapter.myWalletIds).toEqual([])
  })

  it("returns an empty lnurlDomains list (intraledger lookup is disabled in self-custodial)", () => {
    const adapter = createSelfCustodialScanContext([], "mainnet")

    expect(adapter.lnurlDomains).toEqual([])
  })
})
