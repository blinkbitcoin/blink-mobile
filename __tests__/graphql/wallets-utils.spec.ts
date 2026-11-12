import { WalletCurrency } from "@app/graphql/generated"
import { getCardAccount, getWalletIds, getWallets } from "@app/graphql/wallets-utils"
import { CARD } from "@app/types/amounts"

const btcWallet = { id: "btc-1", walletCurrency: WalletCurrency.Btc, balance: 0 }
const usdWallet = { id: "usd-1", walletCurrency: WalletCurrency.Usd, balance: 0 }
const cardAccount = { id: "card-1", walletCurrency: CARD, balance: 5_000 }

describe("getWallets", () => {
  it("returns the wallets without the card", () => {
    expect(getWallets([btcWallet, usdWallet, cardAccount])).toEqual([
      btcWallet,
      usdWallet,
    ])
  })

  it("returns every account when there is no card", () => {
    expect(getWallets([btcWallet, usdWallet])).toEqual([btcWallet, usdWallet])
  })

  it("returns undefined when there are no accounts", () => {
    expect(getWallets(undefined)).toBeUndefined()
  })
})

describe("getCardAccount", () => {
  it("returns the card among the accounts", () => {
    expect(getCardAccount([btcWallet, usdWallet, cardAccount])).toEqual(cardAccount)
  })

  it("returns undefined when there is no card", () => {
    expect(getCardAccount([btcWallet, usdWallet])).toBeUndefined()
    expect(getCardAccount(undefined)).toBeUndefined()
  })
})

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
