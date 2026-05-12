import { Network as GaloyNetwork, WalletCurrency } from "@app/graphql/generated"
import { createSelfCustodialScanContext } from "@app/self-custodial/adapters/scan-context-adapter"
import { type WalletState, toWalletId } from "@app/types/wallet.types"

jest.mock("@app/self-custodial/config", () => ({
  SparkNetworkLabel: "mainnet",
}))

const buildWallet = (id: string): WalletState => ({
  id: toWalletId(id),
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
})

describe("createSelfCustodialScanContext", () => {
  it("maps wallet ids from the active self-custodial wallets", () => {
    const adapter = createSelfCustodialScanContext([
      buildWallet("sc-btc"),
      buildWallet("sc-usd"),
    ])

    expect(adapter.myWalletIds).toEqual(["sc-btc", "sc-usd"])
  })

  it("returns bitcoinNetwork equal to SparkNetworkLabel from config", () => {
    const adapter = createSelfCustodialScanContext([])

    expect(adapter.bitcoinNetwork).toBe(GaloyNetwork.Mainnet)
  })

  it("returns an empty wallet id list when no wallets are connected", () => {
    const adapter = createSelfCustodialScanContext([])

    expect(adapter.myWalletIds).toEqual([])
  })

  it("returns an empty lnurlDomains list (intraledger lookup is disabled in SC)", () => {
    const adapter = createSelfCustodialScanContext([])

    expect(adapter.lnurlDomains).toEqual([])
  })
})
