import React, { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"

import { InfoCard, ShippingAddressForm } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"

import { ShippingAddress } from "../types"
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

  const navigation = useNavigation()
  const { initialAddress, loading } = useShippingAddressData()
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS)
  const savedAddressRef = useRef<ShippingAddress>(EMPTY_ADDRESS)

  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress)
      savedAddressRef.current = initialAddress
    }
  }, [initialAddress])

  const isDirty = useMemo(
    () => JSON.stringify(address) !== JSON.stringify(savedAddressRef.current),
    [address],
  )

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (!isDirty) return

      e.preventDefault()
      Alert.alert(LL.common.warning(), LL.common.discardChangesMessage(), [
        { text: LL.common.cancel(), style: "cancel" },
        {
          text: LL.common.discard(),
          style: "destructive",
          onPress: () => navigation.dispatch(e.data.action),
        },
      ])
    })
  }, [navigation, isDirty, LL])

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
        <ShippingAddressForm address={address} onAddressChange={setAddress} />

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
