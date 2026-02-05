import React from "react"
import { View } from "react-native"

import { Text, useTheme } from "@rn-vui/themed"

import {
  CheckboxRow,
  MultiLineField,
  SelectableOptionRow,
} from "@app/components/card-screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { SettingsGroup } from "@app/screens/settings-screen/group"

import { MOCK_USER } from "../../card-mock-data"
import { useSharedStepStyles } from "./shared-styles"
import { Delivery, DeliveryType } from "./types"

type DeliveryStepProps = {
  selectedDelivery: DeliveryType | null
  onSelectDelivery: (delivery: DeliveryType) => void
  useRegisteredAddress: boolean
  onToggleUseRegisteredAddress: () => void
  onEditAddress: () => void
}

export const DeliveryStep: React.FC<DeliveryStepProps> = ({
  selectedDelivery,
  onSelectDelivery,
  useRegisteredAddress,
  onToggleUseRegisteredAddress,
  onEditAddress,
}) => {
  const styles = useSharedStepStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const { Delivery: deliveryLL } = LL.CardFlow.ReplaceCard

  const currentAddress = useRegisteredAddress
    ? MOCK_USER.registeredAddress
    : MOCK_USER.shippingAddress

  const getDays = (type: DeliveryType) => {
    const config = replaceCardDeliveryConfig[type]
    return deliveryLL.businessDays({
      day1: config.minDays.toString(),
      day2: config.maxDays.toString(),
    })
  }

  const getPrice = (type: DeliveryType) => {
    const { priceUsd } = replaceCardDeliveryConfig[type]
    return priceUsd === 0
      ? deliveryLL.free()
      : formatCurrency({ amountInMajorUnits: priceUsd, currency: WalletCurrency.Usd })
  }

  return (
    <>
      <SettingsGroup
        containerStyle={styles.settingsGroupContainer}
        dividerStyle={styles.dividerStyle}
        items={[
          () => (
            <SelectableOptionRow
              icon="delivery"
              iconColor={colors.grey2}
              title={deliveryLL.standardDelivery()}
              subtitle={getDays(Delivery.Standard)}
              value={getPrice(Delivery.Standard)}
              valueColor={colors._green}
              isSelected={selectedDelivery === Delivery.Standard}
              onPress={() => onSelectDelivery(Delivery.Standard)}
            />
          ),
          () => (
            <SelectableOptionRow
              icon="lightning"
              iconColor={colors.grey2}
              title={deliveryLL.expressDelivery()}
              subtitle={getDays(Delivery.Express)}
              value={getPrice(Delivery.Express)}
              valueColor={colors.black}
              isSelected={selectedDelivery === Delivery.Express}
              onPress={() => onSelectDelivery(Delivery.Express)}
            />
          ),
        ]}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{deliveryLL.shippingAddress()}</Text>
        <MultiLineField
          lines={currentAddress}
          leftIcon="map-pin"
          rightIcon="pencil"
          onPress={onEditAddress}
        />
      </View>

      <CheckboxRow
        label={deliveryLL.useRegisteredAddress()}
        isChecked={useRegisteredAddress}
        onPress={onToggleUseRegisteredAddress}
      />
    </>
  )
}
