import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { EditFieldModal } from "./edit-field-modal"
import { InputField, ValueStyle } from "./input-field"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  COUNTRIES,
  ShippingAddress,
  US_STATES,
} from "@app/screens/card-screen/card-mock-data"

type TextEditingField = "fullName" | "addressLine1" | "addressLine2"
type EditingField = TextEditingField | null

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

  const [editingField, setEditingField] = useState<EditingField>(null)

  const handleOpenEdit = (field: EditingField) => {
    setEditingField(field)
  }

  const handleCloseEdit = () => {
    setEditingField(null)
  }

  const handleSave = (newValue: string) => {
    if (editingField) {
      onAddressChange({
        ...address,
        [editingField]: newValue,
      })
    }
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

  const getFieldLabel = (field: EditingField): string => {
    switch (field) {
      case "fullName":
        return LL.CardFlow.ShippingAddress.fullName()
      case "addressLine1":
        return LL.CardFlow.ShippingAddress.addressLine1()
      case "addressLine2":
        return LL.CardFlow.ShippingAddress.addressLine2()
      default:
        return ""
    }
  }

  const getFieldValue = (field: EditingField): string => (field ? address[field] : "")

  return (
    <View style={styles.container}>
      {showFullName && (
        <InputField
          label={LL.CardFlow.ShippingAddress.fullName()}
          value={address.fullName}
          rightIcon="pencil"
          valueStyle={ValueStyle.Bold}
          onPress={() => handleOpenEdit("fullName")}
        />
      )}

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine1()}
        value={address.addressLine1}
        rightIcon="pencil"
        valueStyle={ValueStyle.Bold}
        onPress={() => handleOpenEdit("addressLine1")}
      />

      <InputField
        label={LL.CardFlow.ShippingAddress.addressLine2()}
        value={address.addressLine2}
        rightIcon="pencil"
        valueStyle={ValueStyle.Bold}
        onPress={() => handleOpenEdit("addressLine2")}
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

      <EditFieldModal
        isVisible={editingField !== null}
        toggleModal={handleCloseEdit}
        fieldName={getFieldLabel(editingField)}
        initialValue={getFieldValue(editingField)}
        onSave={handleSave}
      />
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
