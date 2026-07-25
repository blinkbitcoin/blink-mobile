type WalletOverviewFixture = {
  btcBalance?: number
  usdBalance?: number
  loading?: boolean
}

/**
 * Shared wallet-overview query fixture for the migration specs: one BTC and one USD
 * wallet with obviously synthetic ids, shaped like useWalletOverviewScreenQuery's result.
 */
export const walletOverviewQueryResult = ({
  btcBalance = 0,
  usdBalance = 0,
  loading = false,
}: WalletOverviewFixture = {}) => ({
  loading,
  data: {
    me: {
      defaultAccount: {
        wallets: [
          {
            __typename: "BTCWallet",
            id: "btc-1",
            walletCurrency: "BTC",
            balance: btcBalance,
          },
          {
            __typename: "USDWallet",
            id: "usd-1",
            walletCurrency: "USD",
            balance: usdBalance,
          },
        ],
      },
    },
  },
})
