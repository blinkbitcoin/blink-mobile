import React, { useMemo } from "react"
import { View } from "react-native"
import { Text, useTheme } from "@rn-vui/themed"

import { InfoCard, InfoSection, MultiLineField } from "@app/components/card-screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"

import { ShippingAddress, shippingAddressToLines } from "../../card-mock-data"
import { Delivery, DeliveryType } from "../../replace-card-screens/steps/types"
import { useSharedStepStyles } from "./shared-styles"

const MOCK_CARD_DESIGN = "Maxi orange"

type ConfirmStepProps = {
  deliveryType: DeliveryType
  shippingAddress: ShippingAddress
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({
  deliveryType,
  shippingAddress,
}) => {
  const sharedStyles = useSharedStepStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const deliveryConfig = replaceCardDeliveryConfig[deliveryType]
  const { Shipping: shippingLL, Confirm: confirmLL } = LL.CardFlow.OrderPhysicalCard

  const deliveryLabels = useMemo<Record<DeliveryType, string>>(
    () => ({
      [Delivery.Standard]: shippingLL.standardDelivery(),
      [Delivery.Express]: shippingLL.expressDelivery(),
    }),
    [shippingLL],
  )

  const deliveryPrice =
    deliveryConfig.priceUsd === 0
      ? shippingLL.free()
      : formatCurrency({
          amountInMajorUnits: deliveryConfig.priceUsd,
          currency: WalletCurrency.Usd,
        })

  return (
    <>
      <InfoSection
        title={confirmLL.orderSummary()}
        items={[
          {
            label: confirmLL.cardDesign(),
            value: MOCK_CARD_DESIGN,
          },
          {
            label: confirmLL.delivery(),
            value: deliveryLabels[deliveryType],
          },
          {
            label: confirmLL.deliveryTime(),
            value: shippingLL.businessDays({
              day1: deliveryConfig.minDays.toString(),
              day2: deliveryConfig.maxDays.toString(),
            }),
          },
          {
            label: confirmLL.shippingCost(),
            value: deliveryPrice,
            valueColor: deliveryType === Delivery.Standard ? colors._green : undefined,
          },
        ]}
      />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>{confirmLL.shippingAddress()}</Text>
        <MultiLineField
          lines={shippingAddressToLines(shippingAddress, true)}
          leftIcon="map-pin"
        />
      </View>

      <InfoCard
        title={confirmLL.important()}
        bulletItems={[confirmLL.bullet1(), confirmLL.bullet2(), confirmLL.bullet3()]}
        size="lg"
      />
    </>
  )
}
