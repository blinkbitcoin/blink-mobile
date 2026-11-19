import * as React from "react"

import {
  OfferSummaryRow,
  SubscriptionOfferCardProps,
} from "@app/components/card-screen/subscription-offer-card"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { formatDateFromNow } from "@app/utils/date"

export const SUBSCRIPTION_RENEWAL_MONTHS = 12

export type SubscriptionOffer = SubscriptionOfferCardProps & {
  isFree: boolean
}

/** What the membership card shows: a price of zero in Remote Config is the free offer,
 *  any other price the paid one, whose status depends on the step showing it. */
export const useSubscriptionOffer = ({
  isSubscribeVariant,
}: {
  isSubscribeVariant: boolean
}): SubscriptionOffer => {
  const { LL, locale } = useI18nContext()
  const { cardSubscriptionPriceUsd } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  return React.useMemo(() => {
    const copy = LL.CardFlow.Onboarding.CardSubscription
    const formatUsd = (amount: number) =>
      formatCurrency({ amountInMajorUnits: amount, currency: WalletCurrency.Usd })

    if (cardSubscriptionPriceUsd === 0) {
      const zeroAmount = formatUsd(0)
      return {
        isFree: true,
        title: copy.cardTitle(),
        price: copy.free(),
        priceTone: "positive",
        caption: copy.forNow(),
        rows: [
          { label: copy.freeBreakdown.card(), value: zeroAmount, tone: "default" },
          {
            label: copy.freeBreakdown.memberBenefits(),
            value: zeroAmount,
            tone: "default",
          },
        ],
      }
    }

    const statusRow: OfferSummaryRow = isSubscribeVariant
      ? {
          label: copy.status.specialOfferLabel(),
          value: copy.status.firstYearFree(),
          tone: "positive",
        }
      : {
          label: copy.status.label(),
          value: copy.status.paymentPending(),
          tone: "accent",
        }

    return {
      isFree: false,
      title: copy.cardTitle(),
      price: formatUsd(cardSubscriptionPriceUsd),
      priceTone: "accent",
      caption: copy.perYear(),
      rows: [
        statusRow,
        {
          label: copy.renewalDate.label(),
          value: formatDateFromNow({ months: SUBSCRIPTION_RENEWAL_MONTHS, locale }),
          tone: "default",
        },
      ],
    }
  }, [LL, cardSubscriptionPriceUsd, formatCurrency, isSubscribeVariant, locale])
}
