import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"

export type CourierDelivery = {
  title: string
  businessDays: string
  firstCardPrice: string
  replacementPrice: string
  isReplacementFree: boolean
}

/** Cards ship by courier. Its business days come from Remote Config; the first card
 *  ships free, and the replacement costs what the config says, free while it says 0. */
export const useCourierDelivery = (): CourierDelivery => {
  const { LL } = useI18nContext()
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const deliveryLL = LL.CardFlow.Delivery
  const { minDays, maxDays, priceUsd } = replaceCardDeliveryConfig.courier
  const isReplacementFree = priceUsd === 0

  return {
    title: deliveryLL.courier(),
    businessDays: deliveryLL.businessDays({
      day1: minDays.toString(),
      day2: maxDays.toString(),
    }),
    firstCardPrice: deliveryLL.free(),
    replacementPrice: isReplacementFree
      ? deliveryLL.free()
      : formatCurrency({ amountInMajorUnits: priceUsd, currency: WalletCurrency.Usd }),
    isReplacementFree,
  }
}
