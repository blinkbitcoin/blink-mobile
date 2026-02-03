import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import {
  EditFieldModal,
  InfoCard,
  InputField,
  ValueStyle,
} from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  COUNTRIES,
  MOCK_SHIPPING_ADDRESS,
  ShippingAddress,
  US_STATES,
} from "./card-mock-data"

type EditableField = keyof ShippingAddress | null

export const CardShippingAddressScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [address, setAddress] = useState<ShippingAddress>(MOCK_SHIPPING_ADDRESS)
  const [editingField, setEditingField] = useState<EditableField>(null)

  const handleOpenEdit = (field: EditableField) => {
    setEditingField(field)
  }

  const handleCloseEdit = () => {
    setEditingField(null)
  }

  const handleSave = (newValue: string) => {
    if (editingField) {
      setAddress((prev) => ({
        ...prev,
        [editingField]: newValue,
      }))
    }
  }

  const handleStateSelect = () => {
    navigation.navigate("selectionScreen", {
      title: LL.CardFlow.ShippingAddress.state(),
      options: US_STATES,
      selectedValue: address.state,
      onSelect: (value: string) => {
        setAddress((prev) => ({ ...prev, state: value }))
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
        setAddress((prev) => ({ ...prev, country: value }))
        navigation.goBack()
      },
    })
  }

  const getFieldLabel = (field: EditableField): string => {
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

  const getFieldValue = (field: EditableField): string => (field ? address[field] : "")

  const bulletItems = [
    LL.CardFlow.ShippingAddress.noPOBoxes(),
    LL.CardFlow.ShippingAddress.signatureRequired(),
    LL.CardFlow.ShippingAddress.supportedRegions(),
  ]

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <InputField
          label={LL.CardFlow.ShippingAddress.fullName()}
          value={address.fullName}
          rightIcon="pencil"
          valueStyle={ValueStyle.Bold}
          onPress={() => handleOpenEdit("fullName")}
        />

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

        <InfoCard
          title={LL.CardFlow.ShippingAddress.important()}
          description={LL.CardFlow.ShippingAddress.importantDescription()}
          bulletItems={bulletItems}
        />
      </View>

      <EditFieldModal
        isVisible={editingField !== null}
        toggleModal={handleCloseEdit}
        fieldName={getFieldLabel(editingField)}
        initialValue={getFieldValue(editingField)}
        onSave={handleSave}
      />
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
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
}))
