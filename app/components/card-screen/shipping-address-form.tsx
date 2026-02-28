import React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { InputField, ValueStyle } from "./input-field"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  COUNTRIES,
  ShippingAddress,
  US_STATES,
} from "@app/screens/card-screen/card-mock-data"

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
      options: US_STATES,
      selectedValue: address.state,
      onSelect: (value: string) => {
        onAddressChange({ ...address, state: value })
        navigation.goBack()
      },
    })
  }

  const handleCountrySelect = () => {
    navigation.navigate("selectionScreen", {
      title: LL.CardFlow.ShippingAddress.country(),
      options: COUNTRIES,
      selectedValue: address.country,
      onSelect: (value: string) => {
        onAddressChange({ ...address, country: value })
        navigation.goBack()
      },
    })
  }

  return (
    <View style={styles.container}>
      {showFullName && (
        <InputField
          label={LL.CardFlow.ShippingAddress.fullName()}
          value={address.fullName}
          editable
          rightIcon="pencil"
          onChangeText={(text) => handleFieldChange("fullName", text)}
          valueStyle={ValueStyle.Bold}
        />
      )}

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine1()}
        value={address.addressLine1}
        editable
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("addressLine1", text)}
        valueStyle={ValueStyle.Bold}
      />

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine2()}
        value={address.addressLine2}
        editable
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("addressLine2", text)}
        valueStyle={ValueStyle.Bold}
      />

      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.city()}
            value={address.city}
            valueStyle={ValueStyle.Regular}
          />
        </View>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.state()}
            value={address.state}
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
            valueStyle={ValueStyle.Regular}
          />
        </View>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.country()}
            value={address.country}
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
