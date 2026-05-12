import { Network, type ScanningQrCodeScreenQuery } from "@app/graphql/generated"

import { createCustodialScanContext } from "@app/custodial/adapters/scan-context-adapter"

const buildQueryData = (overrides: {
  network?: Network
  walletIds?: string[]
}): ScanningQrCodeScreenQuery => ({
  __typename: "Query",
  globals: overrides.network
    ? { __typename: "Globals", network: overrides.network }
    : undefined,
  me: {
    __typename: "User",
    id: "me-id",
    defaultAccount: {
      __typename: "ConsumerAccount",
      id: "account-id",
      wallets: (overrides.walletIds ?? []).map((id) => ({
        __typename: "BTCWallet",
        id,
      })),
    },
    contacts: [],
  },
})

describe("createCustodialScanContext", () => {
  it("maps wallet ids from the authed query", () => {
    const adapter = createCustodialScanContext(
      buildQueryData({ network: Network.Mainnet, walletIds: ["btc-1", "usd-2"] }),
      null,
      "blink.sv",
    )

    expect(adapter.myWalletIds).toEqual(["btc-1", "usd-2"])
    expect(adapter.bitcoinNetwork).toBe(Network.Mainnet)
  })

  it("uses fallback network when the authed query has no globals", () => {
    const adapter = createCustodialScanContext(
      buildQueryData({ walletIds: ["btc-1"] }),
      Network.Regtest,
      "blink.sv",
    )

    expect(adapter.bitcoinNetwork).toBe(Network.Regtest)
  })

  it("prefers the authed network over the fallback when both are present", () => {
    const adapter = createCustodialScanContext(
      buildQueryData({ network: Network.Mainnet, walletIds: [] }),
      Network.Regtest,
      "blink.sv",
    )

    expect(adapter.bitcoinNetwork).toBe(Network.Mainnet)
  })

  it("returns an empty wallet id list when the query is undefined", () => {
    const adapter = createCustodialScanContext(undefined, Network.Mainnet, "blink.sv")

    expect(adapter.myWalletIds).toEqual([])
    expect(adapter.bitcoinNetwork).toBe(Network.Mainnet)
  })

  it("returns null network when both authed and fallback are missing", () => {
    const adapter = createCustodialScanContext(undefined, null, "blink.sv")

    expect(adapter.bitcoinNetwork).toBeNull()
    expect(adapter.myWalletIds).toEqual([])
  })

  it("returns [lnAddressHostname, ...LNURL_DOMAINS] as lnurlDomains", () => {
    const adapter = createCustodialScanContext(undefined, null, "blink.sv")

    expect(adapter.lnurlDomains).toEqual([
      "blink.sv",
      "blink.sv",
      "pay.blink.sv",
      "pay.bbw.sv",
    ])
  })
})
