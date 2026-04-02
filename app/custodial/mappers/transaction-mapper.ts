import {
  TxDirection,
  TxStatus,
  WalletCurrency,
  type TransactionFragment,
} from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"

const mapDirection = (direction: TxDirection): TransactionDirection => {
  if (direction === TxDirection.Send) return TransactionDirection.Send
  return TransactionDirection.Receive
}

const mapStatus = (status: TxStatus): TransactionStatus => {
  if (status === TxStatus.Success) return TransactionStatus.Completed
  if (status === TxStatus.Pending) return TransactionStatus.Pending
  return TransactionStatus.Failed
}

const mapPaymentType = (tx: TransactionFragment): PaymentType => {
  const initiation = tx.initiationVia.__typename

  if (initiation === "InitiationViaIntraLedger") {
    const isConversion =
      tx.settlementVia.__typename === "SettlementViaIntraLedger" &&
      tx.settlementVia.counterPartyWalletId !== null
    if (isConversion) return PaymentType.Conversion
    return PaymentType.Lightning
  }

  if (initiation === "InitiationViaOnChain") return PaymentType.Onchain
  return PaymentType.Lightning
}

const toMoneyAmount = (amount: number, currency: WalletCurrency) => {
  if (currency === WalletCurrency.Btc) return toBtcMoneyAmount(Math.abs(amount))
  return toUsdMoneyAmount(Math.abs(amount))
}

export const mapCustodialTransaction = (
  tx: TransactionFragment,
  walletCurrency: WalletCurrency,
): NormalizedTransaction => ({
  id: tx.id,
  amount: toMoneyAmount(tx.settlementAmount, walletCurrency),
  direction: mapDirection(tx.direction),
  status: mapStatus(tx.status),
  timestamp: tx.createdAt,
  paymentType: mapPaymentType(tx),
  fee: toMoneyAmount(tx.settlementFee, walletCurrency),
  sourceAccountType: AccountType.Custodial,
})

export const mapCustodialTransactions = (
  txs: ReadonlyArray<TransactionFragment>,
  walletCurrency: WalletCurrency,
): NormalizedTransaction[] => txs.map((tx) => mapCustodialTransaction(tx, walletCurrency))
