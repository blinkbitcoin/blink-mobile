import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  InfoCard,
  MultiLineField,
  OptionRow,
  ShippingAddressForm,
} from "@app/components/card-screen"
import { radius } from "@app/rne-theme/radius"
import { CheckboxRow } from "@app/components/checkbox-row"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCourierDelivery } from "@app/screens/card-screen/hooks"
import { ShippingAddress } from "@app/screens/card-screen/types"
import { addressToLines } from "@app/screens/card-screen/utils"

import { useSharedStepStyles } from "./shared-styles"

type ShippingStepProps = {
  hasRegisteredAddress: boolean
  registeredAddress: ShippingAddress
  useRegisteredAddress: boolean
  onToggleUseRegisteredAddress: () => void
  customAddress: ShippingAddress
  onCustomAddressChange: (address: ShippingAddress) => void
  onFormValidityChange?: (isValid: boolean) => void
}

export const ShippingStep: React.FC<ShippingStepProps> = ({
  hasRegisteredAddress,
  registeredAddress,
  useRegisteredAddress,
  onToggleUseRegisteredAddress,
  customAddress,
  onCustomAddressChange,
  onFormValidityChange,
}) => {
  const sharedStyles = useSharedStepStyles()
  const localStyles = useLocalStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const courier = useCourierDelivery()

  const { Shipping: shippingLL } = LL.CardFlow.OrderPhysicalCard

  return (
    <>
      {hasRegisteredAddress && useRegisteredAddress && (
        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>{shippingLL.registeredAddress()}</Text>
          <MultiLineField
            lines={addressToLines(registeredAddress, false)}
            leftIcon="map-pin"
          />
        </View>
      )}

      <View style={localStyles.checkboxFormGroup}>
        {hasRegisteredAddress && (
          <CheckboxRow
            label={shippingLL.useRegisteredAddress()}
            isChecked={useRegisteredAddress}
            onPress={onToggleUseRegisteredAddress}
          />
        )}

        {!useRegisteredAddress && (
          <>
            <ShippingAddressForm
              address={customAddress}
              onAddressChange={onCustomAddressChange}
              onValidityChange={onFormValidityChange}
            />
            <InfoCard
              title={LL.CardFlow.ShippingAddress.important()}
              description={LL.CardFlow.ShippingAddress.importantDescription()}
              bulletItems={[
                LL.CardFlow.ShippingAddress.noPOBoxes(),
                LL.CardFlow.ShippingAddress.signatureRequired(),
                LL.CardFlow.ShippingAddress.supportedRegions(),
              ]}
              size="lg"
            />
          </>
        )}
      </View>

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>{shippingLL.delivery()}</Text>
        <View style={localStyles.deliveryCard}>
          <OptionRow
            icon="delivery"
            iconColor={colors.textMuted}
            title={courier.title}
            subtitle={courier.businessDays}
            value={courier.firstCardPrice}
            valueColor={colors.success}
          />
        </View>
      </View>

      <InfoCard
        title={shippingLL.deliveryInformation()}
        bulletItems={[
          shippingLL.bullet1(),
          shippingLL.bullet2(),
          shippingLL.bullet3(),
          shippingLL.bullet4(),
        ]}
        showIcon={false}
        size="lg"
      />

      <InfoCard
        title={shippingLL.cardFeatures()}
        bulletItems={[
          shippingLL.feature1(),
          shippingLL.feature2(),
          shippingLL.feature3(),
          shippingLL.feature4(),
        ]}
        showIcon={false}
        size="lg"
      />
    </>
  )
}

const useLocalStyles = makeStyles(() => ({
  checkboxFormGroup: {
    gap: 17,
  },
  deliveryCard: {
    borderRadius: radius.default,
    overflow: "hidden",
  },
}))
