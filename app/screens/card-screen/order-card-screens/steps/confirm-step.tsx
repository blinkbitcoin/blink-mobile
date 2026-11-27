import React from "react"
import { View } from "react-native"
import { Text, useTheme } from "@rn-vui/themed"

import { InfoSection, MultiLineField } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCourierDelivery } from "@app/screens/card-screen/hooks"
import {
  CardDesign,
  CardDesignType,
  ShippingAddress,
} from "@app/screens/card-screen/types"
import { addressToLines } from "@app/screens/card-screen/utils"

import { useSharedStepStyles } from "./shared-styles"

type ConfirmStepProps = {
  shippingAddress: ShippingAddress
  cardDesign?: CardDesignType
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({
  shippingAddress,
  cardDesign = CardDesign.BlinkOrange,
}) => {
  const sharedStyles = useSharedStepStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const courier = useCourierDelivery()

  const { Confirm: confirmLL } = LL.CardFlow.OrderPhysicalCard

  return (
    <>
      <InfoSection
        title={confirmLL.orderSummary()}
        items={[
          {
            label: confirmLL.cardDesign(),
            value: cardDesign,
          },
          {
            label: confirmLL.delivery(),
            value: courier.title,
          },
          {
            label: confirmLL.deliveryTime(),
            value: courier.businessDays,
          },
          {
            label: confirmLL.shippingCost(),
            value: courier.firstCardPrice,
            valueColor: colors.success,
          },
        ]}
      />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>{confirmLL.shippingAddress()}</Text>
        <MultiLineField
          lines={addressToLines(shippingAddress, true)}
          leftIcon="map-pin"
        />
      </View>
    </>
  )
}
