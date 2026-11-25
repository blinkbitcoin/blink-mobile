import {
  CardDeclineReason,
  CardPaymentMethod,
  CardStatus,
  CardType,
  TransactionStatus,
} from "@app/graphql/generated"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"
import { parseCardValidThru } from "@app/utils/date"

export const isCardFrozen = (status: CardStatus): boolean => status === CardStatus.Locked

export const isCardUsable = (status: CardStatus): boolean =>
  status === CardStatus.Active || status === CardStatus.Locked

/** The expiry as the card prints it, `MM/YY`; null until the issuer set one. */
export const formatCardExpiry = (expiry: string | null): string | null => {
  const parts = expiry ? parseCardValidThru(expiry) : null
  return parts ? `${parts.month}/${parts.year}` : null
}

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

export const formatPaymentMethod = (
  method: CardPaymentMethod,
  LL: {
    contactless: () => string
    chip: () => string
    swipe: () => string
    online: () => string
    other: () => string
  },
): string => {
  switch (method) {
    case CardPaymentMethod.Contactless:
      return LL.contactless()
    case CardPaymentMethod.Chip:
      return LL.chip()
    case CardPaymentMethod.Swipe:
      return LL.swipe()
    case CardPaymentMethod.Online:
      return LL.online()
    case CardPaymentMethod.Other:
      return LL.other()
  }
}

/** A network decline can arrive without a reason, which reads like one outside the list:
 *  declined by the network, with nothing more to say. */
export const formatDeclineReason = (
  reason: CardDeclineReason | null | undefined,
  LL: {
    insufficientFunds: () => string
    limitExceeded: () => string
    incorrectPin: () => string
    cardExpired: () => string
    cardLocked: () => string
    suspectedFraud: () => string
    other: () => string
  },
): string => {
  switch (reason) {
    case CardDeclineReason.InsufficientFunds:
      return LL.insufficientFunds()
    case CardDeclineReason.LimitExceeded:
      return LL.limitExceeded()
    case CardDeclineReason.IncorrectPin:
      return LL.incorrectPin()
    case CardDeclineReason.CardExpired:
      return LL.cardExpired()
    case CardDeclineReason.CardLocked:
      return LL.cardLocked()
    case CardDeclineReason.SuspectedFraud:
      return LL.suspectedFraud()
    default:
      return LL.other()
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
