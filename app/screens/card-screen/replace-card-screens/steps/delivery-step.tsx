import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  MultiLineField,
  SelectableOptionRow,
  ShippingAddressForm,
} from "@app/components/card-screen"
import { CheckboxRow } from "@app/components/checkbox-row"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCourierDelivery } from "@app/screens/card-screen/hooks"
import { SettingsGroup } from "@app/screens/settings-screen/group"

import { Delivery, DeliveryType, ShippingAddress } from "@app/screens/card-screen/types"
import { addressToLines } from "@app/screens/card-screen/utils"

import { useSharedStepStyles } from "./shared-styles"

type DeliveryStepProps = {
  selectedDelivery: DeliveryType
  onSelectDelivery: (delivery: DeliveryType) => void
  hasRegisteredAddress: boolean
  registeredAddress: ShippingAddress
  useRegisteredAddress: boolean
  onToggleUseRegisteredAddress: () => void
  customAddress: ShippingAddress
  onCustomAddressChange: (address: ShippingAddress) => void
}

export const DeliveryStep: React.FC<DeliveryStepProps> = ({
  selectedDelivery,
  onSelectDelivery,
  hasRegisteredAddress,
  registeredAddress,
  useRegisteredAddress,
  onToggleUseRegisteredAddress,
  customAddress,
  onCustomAddressChange,
}) => {
  const sharedStyles = useSharedStepStyles()
  const localStyles = useLocalStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const courier = useCourierDelivery()

  const { Delivery: deliveryLL } = LL.CardFlow.ReplaceCard
  const sharedDeliveryLL = LL.CardFlow.Delivery
  const courierPriceColor = courier.isReplacementFree
    ? colors.success
    : colors.textOnBackground

  return (
    <>
      {/* Snail mail is shown greyed and not offered: cards ship by courier. */}
      <SettingsGroup
        containerStyle={sharedStyles.settingsGroupContainer}
        dividerStyle={sharedStyles.dividerStyle}
        items={[
          () => (
            <SelectableOptionRow
              icon="delivery"
              iconColor={colors.textMuted}
              title={sharedDeliveryLL.snailMail()}
              subtitle={sharedDeliveryLL.snailMailUnavailable()}
              isSelected={false}
              onPress={() => onSelectDelivery(Delivery.SnailMail)}
              isDisabled
            />
          ),
          () => (
            <SelectableOptionRow
              icon="lightning"
              iconColor={colors.textMuted}
              title={courier.title}
              subtitle={courier.businessDays}
              value={courier.replacementPrice}
              valueColor={courierPriceColor}
              isSelected={selectedDelivery === Delivery.Courier}
              onPress={() => onSelectDelivery(Delivery.Courier)}
            />
          ),
        ]}
      />

      {hasRegisteredAddress && useRegisteredAddress && (
        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>{deliveryLL.shippingAddress()}</Text>
          <MultiLineField
            lines={addressToLines(registeredAddress, false)}
            leftIcon="map-pin"
          />
        </View>
      )}

      <View style={localStyles.checkboxFormGroup}>
        {hasRegisteredAddress && (
          <CheckboxRow
            label={deliveryLL.useRegisteredAddress()}
            isChecked={useRegisteredAddress}
            onPress={onToggleUseRegisteredAddress}
          />
        )}

        {!useRegisteredAddress && (
          <ShippingAddressForm
            address={customAddress}
            onAddressChange={onCustomAddressChange}
            showFullName={false}
          />
        )}
      </View>
    </>
  )
}

const useLocalStyles = makeStyles(() => ({
  checkboxFormGroup: {
    gap: 17,
  },
}))
