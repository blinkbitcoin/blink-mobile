import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { InfoCard, ShippingAddressForm } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"

import { MOCK_SHIPPING_ADDRESS, ShippingAddress } from "./card-mock-data"

export const CardShippingAddressScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const [address, setAddress] = useState<ShippingAddress>(MOCK_SHIPPING_ADDRESS)

  const bulletItems = [
    LL.CardFlow.ShippingAddress.noPOBoxes(),
    LL.CardFlow.ShippingAddress.signatureRequired(),
    LL.CardFlow.ShippingAddress.supportedRegions(),
  ]

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <ShippingAddressForm
          address={address}
          onAddressChange={setAddress}
          showFullName={true}
        />

        <InfoCard
          title={LL.CardFlow.ShippingAddress.important()}
          description={LL.CardFlow.ShippingAddress.importantDescription()}
          bulletItems={bulletItems}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
}))
