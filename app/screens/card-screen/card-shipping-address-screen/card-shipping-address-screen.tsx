import React, { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { InfoCard, ShippingAddressForm } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"

import { ShippingAddress } from "../card-mock-data"
import { useShippingAddressData } from "./hooks"

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
}

export const CardShippingAddressScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const { initialAddress, loading } = useShippingAddressData()
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS)

  useEffect(() => {
    if (initialAddress) setAddress(initialAddress)
  }, [initialAddress])

  if (loading && !initialAddress) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator
            testID="activity-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </Screen>
    )
  }

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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
}))
