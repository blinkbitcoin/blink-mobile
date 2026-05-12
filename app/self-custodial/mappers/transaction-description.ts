import { type TranslationFunctions } from "@app/i18n/i18n-types"
import {
  PaymentType,
  TransactionDirection,
  type NormalizedTransaction,
} from "@app/types/transaction"

const TICKER_DISPLAY: Record<string, string> = {
  USDB: "USD",
}

const displayTicker = (ticker: string): string => TICKER_DISPLAY[ticker] ?? ticker

export const getTransactionDescription = (
  tx: NormalizedTransaction,
  LL: TranslationFunctions,
): string => {
  if (tx.memo?.trim()) return tx.memo

  if (tx.lnAddress) {
    const isSend = tx.direction === TransactionDirection.Send
    if (isSend) return LL.TransactionDescription.payTo({ address: tx.lnAddress })
    return tx.lnAddress
  }

  if (tx.isConversion) {
    const isSend = tx.direction === TransactionDirection.Send
    if (tx.tokenTicker) {
      const token = displayTicker(tx.tokenTicker)
      return isSend
        ? LL.TransactionDescription.conversionFromToken({ token })
        : LL.TransactionDescription.conversionToToken({ token })
    }
    return isSend
      ? LL.TransactionDescription.conversionFromBitcoin()
      : LL.TransactionDescription.conversionToBitcoin()
  }

  if (tx.tokenTicker) {
    return LL.TransactionDescription.tokenTransfer({
      token: displayTicker(tx.tokenTicker),
    })
  }

  if (tx.paymentType === PaymentType.Lightning) {
    return LL.TransactionDescription.lightningPayment()
  }

  if (tx.paymentType === PaymentType.Spark) {
    return LL.TransactionDescription.sparkTransfer()
  }

  if (tx.paymentType === PaymentType.Onchain) {
    const isSend = tx.direction === TransactionDirection.Send
    return isSend
      ? LL.TransactionDescription.onchainWithdrawal()
      : LL.TransactionDescription.onchainDeposit()
  }

  return LL.TransactionDescription.payment()
}
