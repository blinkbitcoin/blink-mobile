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

  /**
   * The domains are what lets a Blink pay code be recognised as naming an account
   * instead of being fetched as an opaque lnurl. Paying one over the ledger is refused
   * separately, by the sender, since a self-custodial wallet has no token for it.
   */
  it("declares the network's own domain first, so an address is spelled with it", () => {
    const { lnurlDomains } = createSelfCustodialScanContext([], Network.Mainnet)

    expect(lnurlDomains[0]).toBe("blink.sv")
    expect(lnurlDomains).toContain("pay.blink.sv")
  })

  it("declares the regtest domains on regtest, and none of production's", () => {
    const { lnurlDomains } = createSelfCustodialScanContext([], Network.Regtest)

    expect(lnurlDomains).toEqual(["staging.blink.sv", "pay.staging.blink.sv"])
  })
})
