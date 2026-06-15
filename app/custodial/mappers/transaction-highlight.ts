import { WalletCurrency } from "@app/graphql/generated"

export const shouldHighlightById = ({
  txId,
  settlementCurrency,
  walletFilter,
  baselineBtcId,
  baselineUsdId,
  lastSeenIdForAll,
  latestTxIdForCurrency,
}: {
  txId: string
  settlementCurrency: WalletCurrency
  walletFilter: WalletCurrency | "ALL"
  baselineBtcId: string
  baselineUsdId: string
  lastSeenIdForAll: string
  latestTxIdForCurrency: string
}): boolean => {
  const lastSeenIdForCurrency =
    settlementCurrency === WalletCurrency.Btc ? baselineBtcId : baselineUsdId

  if (walletFilter === "ALL") {
    if (lastSeenIdForAll) {
      return txId > lastSeenIdForCurrency && txId > lastSeenIdForAll
    }
    return lastSeenIdForCurrency
      ? txId > lastSeenIdForCurrency
      : txId === latestTxIdForCurrency
  }

  if (settlementCurrency !== walletFilter) return false

  return lastSeenIdForCurrency
    ? txId > lastSeenIdForCurrency
    : txId === latestTxIdForCurrency
}
