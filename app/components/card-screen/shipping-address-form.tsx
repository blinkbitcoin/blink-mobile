import React, { useEffect, useMemo } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { InputField, ValueStyle } from "./input-field"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ShippingAddress } from "@app/screens/card-screen/types"
import { validateAddress } from "@app/screens/card-screen/utils"
import {
  getAllCountries,
  getCountryLabel,
  getRegionsByCountry,
} from "@app/utils/country-region-data"

type ShippingAddressFormProps = {
  address: ShippingAddress
  onAddressChange: (address: ShippingAddress) => void
  onValidityChange?: (isValid: boolean) => void
  showFullName?: boolean
}

export const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  address,
  onAddressChange,
  onValidityChange,
  showFullName = true,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { errors, isValid } = useMemo(
    () =>
      validateAddress(
        address,
        {
          required: LL.common.validation.required(),
          minChars: LL.common.validation.minChars,
          noPOBoxes: LL.CardFlow.ShippingAddress.noPOBoxes(),
          invalidPostalCode: LL.common.validation.invalidPostalCode(),
        },
        { checkFullName: showFullName },
      ),
    [address, showFullName, LL],
  )

  useEffect(() => {
    onValidityChange?.(isValid)
  }, [isValid, onValidityChange])

  const handleFieldChange = (field: keyof ShippingAddress, value: string) => {
    onAddressChange({ ...address, [field]: value })
  }

  const regions = getRegionsByCountry(address.countryCode)
  const countryHasRegions = regions.length > 0

  const handleStateSelect = () => {
    navigation.navigate("selectionScreen", {
      title: LL.CardFlow.ShippingAddress.state(),
      options: regions,
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
      options: getAllCountries(),
      selectedValue: address.countryCode,
      onSelect: (value: string) => {
        const firstRegion = getRegionsByCountry(value)[0]?.value ?? ""
        onAddressChange({
          ...address,
          countryCode: value,
          region: firstRegion,
          postalCode: "",
        })
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
          errorMessage={errors.firstName}
        />
      )}

      {showFullName && (
        <InputField
          label={LL.CardFlow.ShippingAddress.lastName()}
          value={address.lastName}
          rightIcon="pencil"
          onChangeText={(text) => handleFieldChange("lastName", text)}
          valueStyle={ValueStyle.Bold}
          errorMessage={errors.lastName}
        />
      )}

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine1()}
        value={address.line1}
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("line1", text)}
        valueStyle={ValueStyle.Bold}
        errorMessage={errors.line1}
      />

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine2()}
        value={address.line2}
        rightIcon="pencil"
        onChangeText={(text) => handleFieldChange("line2", text)}
        valueStyle={ValueStyle.Bold}
        errorMessage={errors.line2}
      />

      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.city()}
            value={address.city}
            onChangeText={(text) => handleFieldChange("city", text)}
            valueStyle={ValueStyle.Regular}
            errorMessage={errors.city}
          />
        </View>
        <View style={styles.gridItem}>
          {countryHasRegions ? (
            <InputField
              label={LL.CardFlow.ShippingAddress.state()}
              value={address.region}
              rightIcon="caret-down"
              valueStyle={ValueStyle.Regular}
              onPress={handleStateSelect}
            />
          ) : (
            <InputField
              label={LL.CardFlow.ShippingAddress.region()}
              value={address.region}
              rightIcon="pencil"
              onChangeText={(text) => handleFieldChange("region", text)}
              valueStyle={ValueStyle.Regular}
            />
          )}
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.postalCode()}
            value={address.postalCode}
            onChangeText={(text) => handleFieldChange("postalCode", text)}
            valueStyle={ValueStyle.Regular}
            errorMessage={errors.postalCode}
          />
        </View>
        <View style={styles.gridItem}>
          <InputField
            label={LL.CardFlow.ShippingAddress.country()}
            value={getCountryLabel(address.countryCode)}
            rightIcon="caret-down"
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
    gap: 4,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
}))
