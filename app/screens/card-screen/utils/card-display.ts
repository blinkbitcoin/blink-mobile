import { CardStatus, CardType, TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"

export const isCardFrozen = (status: CardStatus): boolean => status === CardStatus.Locked

export const formatCardType = (
  cardType: CardType,
  LL: { cardTypeVirtual: () => string; cardTypePhysical: () => string },
): string => {
  switch (cardType) {
    case CardType.Virtual:
      return LL.cardTypeVirtual()
    case CardType.Physical:
      return LL.cardTypePhysical()
  }
}

export const formatIssuedDate = (isoDate: string, locale: string): string =>
  new Date(isoDate).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

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
