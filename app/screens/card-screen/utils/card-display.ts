import { CardStatus, TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"

export const isCardFrozen = (status: CardStatus): boolean => status === CardStatus.Locked

export const mapTransactionStatus = (
  status: TransactionStatus,
): CardTransactionUiStatus => {
  switch (status) {
    case TransactionStatus.Pending:
      return CardTransactionUiStatus.Pending
    case TransactionStatus.Declined:
      return CardTransactionUiStatus.Declined
    case TransactionStatus.Reversed:
      return CardTransactionUiStatus.Reversed
    default:
      return CardTransactionUiStatus.Completed
  }
}
