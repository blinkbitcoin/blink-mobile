import { CardStatus, CardType, TransactionStatus } from "@app/graphql/generated"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"

export const isCardFrozen = (status: CardStatus): boolean => status === CardStatus.Locked

export const isCardUsable = (status: CardStatus): boolean =>
  status === CardStatus.Active || status === CardStatus.Locked

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

/** A calendar date such as 2026-07-01, read and shown in UTC: read as the device's
 *  midnight, a phone west of Greenwich would show the day before. */
export const formatCalendarDate = (isoDate: string, locale: string): string =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
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

type MerchantCategoryRange = {
  from: number
  to: number
  icon: IconNamesType
}

/**
 * Merchant category codes (ISO 18245) grouped by what was bought: 5812 to 5814 are eating
 * places, bars and fast food, and 4111 to 4131 are commuter transport, taxis, rideshare
 * and bus lines. Any other code, or none, shows the store.
 */
const MERCHANT_CATEGORY_ICONS: readonly MerchantCategoryRange[] = [
  { from: 5812, to: 5814, icon: "fork-knife" },
  { from: 4111, to: 4131, icon: "car" },
]

const MERCHANT_ICON: IconNamesType = "storefront"

export const merchantIcon = (
  merchantCategoryCode: string | null | undefined,
): IconNamesType => {
  const code = Number(merchantCategoryCode)
  const range = MERCHANT_CATEGORY_ICONS.find(({ from, to }) => code >= from && code <= to)
  return range?.icon ?? MERCHANT_ICON
}
