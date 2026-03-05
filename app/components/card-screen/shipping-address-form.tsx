import React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { InputField, ValueStyle } from "./input-field"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ShippingAddress } from "@app/screens/card-screen/card-mock-data"
import {
  COUNTRIES,
  getRegionsByCountry,
} from "@app/screens/card-screen/country-region-data"

type ShippingAddressFormProps = {
  address: ShippingAddress
  onAddressChange: (address: ShippingAddress) => void
  showFullName?: boolean
}

export const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  address,
  onAddressChange,
  showFullName = true,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleFieldChange = (field: keyof ShippingAddress, value: string) => {
    onAddressChange({ ...address, [field]: value })
  }

  const handleStateSelect = () => {
    navigation.navigate("selectionScreen", {
      title: LL.CardFlow.ShippingAddress.state(),
      options: getRegionsByCountry(address.countryCode),
      selectedValue: address.region,
      onSelect: (value: string) => {
        onAddressChange({ ...address, region: value })
        navigation.goBack()
      },
    })
  }

  const handleCountrySelect = () => {
    navigation.navigate("selectionScreen", {
      title: LL.CardFlow.ShippingAddress.country(),
      options: COUNTRIES,
      selectedValue: address.countryCode,
      onSelect: (value: string) => {
        const firstRegion = getRegionsByCountry(value)[0]?.value ?? ""
        onAddressChange({ ...address, countryCode: value, region: firstRegion })
        navigation.goBack()
      },
    })
  }

  return (
    <View style={styles.container}>
      {showFullName && (
        <InputField
          label={LL.CardFlow.ShippingAddress.firstName()}
          value={address.firstName}
          rightIcon="pencil"
          onChangeText={(text) => handleFieldChange("firstName", text)}
          valueStyle={ValueStyle.Bold}
        />
      )}

      {showFullName && (
        <InputField
          label={LL.CardFlow.ShippingAddress.lastName()}
          value={address.lastName}
          rightIcon="pencil"
          onChangeText={(text) => handleFieldChange("lastName", text)}
          valueStyle={ValueStyle.Bold}
        />
      )}

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine1()}
        value={address.line1}
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("line1", text)}
        valueStyle={ValueStyle.Bold}
      />

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine2()}
        value={address.line2}
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("line2", text)}
        valueStyle={ValueStyle.Bold}
      />

      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.city()}
            value={address.city}
            onChangeText={(text) => handleFieldChange("city", text)}
            valueStyle={ValueStyle.Regular}
          />
        </View>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.state()}
            value={address.region}
            rightIonicon="chevron-down"
            valueStyle={ValueStyle.Regular}
            onPress={handleStateSelect}
          />
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.postalCode()}
            value={address.postalCode}
            onChangeText={(text) => handleFieldChange("postalCode", text)}
            valueStyle={ValueStyle.Regular}
          />
        </View>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.country()}
            value={address.countryCode}
            rightIonicon="chevron-down"
            valueStyle={ValueStyle.Regular}
            onPress={handleCountrySelect}
          />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    gap: 20,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
}))
