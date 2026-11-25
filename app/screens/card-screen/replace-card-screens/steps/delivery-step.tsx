import React from "react"

import { useTheme } from "@rn-vui/themed"

import {
  PrivacyTipCard,
  SelectableOptionRow,
  ShippingAddressForm,
} from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCourierDelivery } from "@app/screens/card-screen/hooks"
import { KycAddressChoice } from "@app/screens/card-screen/kyc-address-choice"
import { SettingsGroup } from "@app/screens/settings-screen/group"

import { Delivery, DeliveryType, ShippingAddress } from "@app/screens/card-screen/types"

import { useSharedStepStyles } from "./shared-styles"

type DeliveryStepProps = {
  selectedDelivery: DeliveryType
  onSelectDelivery: (delivery: DeliveryType) => void
  kycAddress: ShippingAddress | null
  useKycAddress: boolean
  onToggleUseKycAddress: () => void
  customAddress: ShippingAddress
  onCustomAddressChange: (address: ShippingAddress) => void
}

export const DeliveryStep: React.FC<DeliveryStepProps> = ({
  selectedDelivery,
  onSelectDelivery,
  kycAddress,
  useKycAddress,
  onToggleUseKycAddress,
  customAddress,
  onCustomAddressChange,
}) => {
  const sharedStyles = useSharedStepStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const courier = useCourierDelivery()

  const deliveryLL = LL.CardFlow.Delivery
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
              title={deliveryLL.snailMail()}
              subtitle={deliveryLL.snailMailUnavailable()}
              isSelected={false}
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

      <PrivacyTipCard />

      <KycAddressChoice
        kycAddress={kycAddress}
        isKycAddressUsed={useKycAddress}
        onToggle={onToggleUseKycAddress}
      >
        <ShippingAddressForm
          address={customAddress}
          onAddressChange={onCustomAddressChange}
          showFullName={false}
        />
      </KycAddressChoice>
    </>
  )
}
