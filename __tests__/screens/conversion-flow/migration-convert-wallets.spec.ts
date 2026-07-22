import { WalletCurrency } from "@app/graphql/generated"
import { resolveInitialConvertWallets } from "@app/screens/conversion-flow/migration-convert-wallets"

const btcWallet = { id: "btc-1", balance: 1000, walletCurrency: WalletCurrency.Btc }
const usdWallet = { id: "usd-1", balance: 500, walletCurrency: WalletCurrency.Usd }

describe("resolveInitialConvertWallets", () => {
  it("is undefined until both wallets are known", () => {
    expect(resolveInitialConvertWallets(undefined, usdWallet, false)).toBeUndefined()
    expect(resolveInitialConvertWallets(btcWallet, undefined, false)).toBeUndefined()
  })

  it("opens USD to BTC for a migration conversion", () => {
    expect(resolveInitialConvertWallets(btcWallet, usdWallet, true)).toEqual({
      initialFromWallet: usdWallet,
      initialToWallet: btcWallet,
    })
  })

  it("keeps the BTC to USD default for a plain conversion", () => {
    expect(resolveInitialConvertWallets(btcWallet, usdWallet, false)).toEqual({
      initialFromWallet: btcWallet,
      initialToWallet: usdWallet,
    })
  })
})
