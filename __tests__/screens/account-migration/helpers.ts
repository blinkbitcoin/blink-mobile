import { TxDirection } from "@app/graphql/generated"

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

type PendingTransactionFixture = {
  direction: TxDirection
  settlementVia: { __typename: string }
}

/** A deposit to the custodial on-chain address that has not confirmed yet. */
export const pendingOnChainReceive: PendingTransactionFixture = {
  direction: TxDirection.Receive,
  settlementVia: { __typename: "SettlementViaOnChain" },
}

/**
 * Shared pending-deposits query fixture for the migration specs, shaped like
 * useMigrationPendingDepositsQuery's result. Settled with nothing pending unless a case
 * hands it transactions.
 */
export const pendingDepositsQueryResult = (
  pendingIncomingTransactions: ReadonlyArray<PendingTransactionFixture> = [],
) => {
  const data = {
    me: {
      id: "user-1",
      defaultAccount: {
        id: "account-1",
        pendingIncomingTransactions: pendingIncomingTransactions.map(
          (transaction, index) => ({ id: `pending-${index}`, ...transaction }),
        ),
      },
    },
  }
  /** The refetch answers with the same transactions, as a check run again before they
   *  change would. */
  return {
    loading: false,
    error: undefined,
    data,
    refetch: jest.fn().mockResolvedValue({ data }),
  }
}
