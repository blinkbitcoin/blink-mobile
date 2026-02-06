import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  CheckboxRow,
  InfoCard,
  MultiLineField,
  OptionRow,
  ShippingAddressForm,
} from "@app/components/card-screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"

import { MOCK_USER, ShippingAddress, shippingAddressToLines } from "../../card-mock-data"
import { Delivery } from "../../replace-card-screens/steps/types"
import { useSharedStepStyles } from "./shared-styles"

type ShippingStepProps = {
  useRegisteredAddress: boolean
  onToggleUseRegisteredAddress: () => void
  customAddress: ShippingAddress
  onCustomAddressChange: (address: ShippingAddress) => void
}

export const ShippingStep: React.FC<ShippingStepProps> = ({
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
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const { Shipping: shippingLL } = LL.CardFlow.OrderPhysicalCard

  const currentAddress = useRegisteredAddress
    ? MOCK_USER.registeredAddress
    : customAddress

  const standardConfig = replaceCardDeliveryConfig[Delivery.Standard]

  const standardDays = shippingLL.businessDays({
    day1: standardConfig.minDays.toString(),
    day2: standardConfig.maxDays.toString(),
  })

  const standardPrice =
    standardConfig.priceUsd === 0
      ? shippingLL.free()
      : formatCurrency({
          amountInMajorUnits: standardConfig.priceUsd,
          currency: WalletCurrency.Usd,
        })

  return (
    <>
      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>{shippingLL.registeredAddress()}</Text>
        <MultiLineField
          lines={shippingAddressToLines(currentAddress, false)}
          leftIcon="map-pin"
        />
      </View>

      <View style={localStyles.checkboxFormGroup}>
        <CheckboxRow
          label={shippingLL.useRegisteredAddress()}
          isChecked={useRegisteredAddress}
          onPress={onToggleUseRegisteredAddress}
        />

        {!useRegisteredAddress && (
          <>
            <ShippingAddressForm
              address={customAddress}
              onAddressChange={onCustomAddressChange}
              showFullName={true}
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
            iconColor={colors.grey2}
            title={shippingLL.standardDelivery()}
            subtitle={standardDays}
            value={standardPrice}
            valueColor={colors._green}
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
    borderRadius: 8,
    overflow: "hidden",
  },
}))
