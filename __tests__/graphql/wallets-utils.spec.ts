import { WalletCurrency } from "@app/graphql/generated"
import { getWalletIds } from "@app/graphql/wallets-utils"

const btcWallet = { id: "btc-1", walletCurrency: WalletCurrency.Btc, balance: 0 }
const usdWallet = { id: "usd-1", walletCurrency: WalletCurrency.Usd, balance: 0 }

describe("getWalletIds", () => {
  it("returns the btc and usd wallet ids", () => {
    expect(getWalletIds([btcWallet, usdWallet])).toEqual(["btc-1", "usd-1"])
  })

  it("returns only the wallet id that is present", () => {
    expect(getWalletIds([btcWallet])).toEqual(["btc-1"])
    expect(getWalletIds([usdWallet])).toEqual(["usd-1"])
  })

  it("returns an empty array when there are no wallets", () => {
    expect(getWalletIds([])).toEqual([])
    expect(getWalletIds(undefined)).toEqual([])
  })
})
