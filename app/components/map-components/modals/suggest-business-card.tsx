import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, FlatList, Pressable, TextInput, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import MaterialIcon from "@react-native-vector-icons/material-icons"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import {
  Category,
  categoryI18NNames,
  categoryIcons,
} from "@app/components/map-components/categories.ts"

type Props = {
  closeModal: () => void
  centerCoords: { latitude: number; longitude: number }
}

export const SuggestBusinessCard: FC<Props> = ({ closeModal, centerCoords }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [name, setName] = useState("")
  const [address, setAddress] = useState(
    `${centerCoords.latitude.toFixed(6)}, ${centerCoords.longitude.toFixed(6)}`,
  )
  const userEditedAddress = useRef(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)

  useEffect(() => {
    if (!userEditedAddress.current) {
      setAddress(
        `${centerCoords.latitude.toFixed(6)}, ${centerCoords.longitude.toFixed(6)}`,
      )
    }
  }, [centerCoords.latitude, centerCoords.longitude])

  const categoryList = useMemo(() => {
    return Object.keys(categoryI18NNames).map((key) => {
      const cat = parseInt(key, 10) as Category
      return { category: cat, label: categoryI18NNames[cat] }
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Missing info", "Please enter a business name.")
      return
    }
    // TODO: graphql mutation via proxy
    console.log("Suggest business:", { name, address, category: selectedCategory })
    Alert.alert("Submitted", "Your suggestion has been sent!")
    closeModal()
  }, [name, address, selectedCategory, closeModal])

  const handleCategorySelect = useCallback((cat: Category) => {
    setSelectedCategory(cat)
    setCategoryPickerOpen(false)
  }, [])

  const selectedLabel = selectedCategory
    ? categoryI18NNames[selectedCategory]
    : "Choose a category"

  // @ts-ignore
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggest business</Text>

      {/* Business title */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business title</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name of the Business"
            placeholderTextColor={colors.grey2}
            autoCorrect={false}
            returnKeyType="next"
          />
          <GaloyIcon name="pencil" size={16} color={colors.grey2} />
        </View>
      </View>

      {/* Address */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={(text) => {
              userEditedAddress.current = true
              setAddress(text)
            }}
            placeholder="Coordinates or address"
            placeholderTextColor={colors.grey2}
            autoCorrect={false}
            returnKeyType="next"
          />
          <GaloyIcon name="pencil" size={16} color={colors.grey2} />
        </View>
      </View>

      {/* Category */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Category</Text>
        <Pressable
          style={styles.inputContainer}
          onPress={() => setCategoryPickerOpen(!categoryPickerOpen)}
        >
          <Text style={[styles.inputText, !selectedCategory && { color: colors.grey2 }]}>
            {selectedLabel}
          </Text>
          <GaloyIcon name="caret-down" size={16} color={colors.grey2} />
        </Pressable>
      </View>

      {/* Category dropdown */}
      {categoryPickerOpen && (
        <View style={styles.dropdown}>
          <FlatList
            data={categoryList}
            keyExtractor={(item) => String(item.category)}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.dropdownItem,
                  selectedCategory === item.category && {
                    backgroundColor: colors.grey5,
                  },
                ]}
                onPress={() => handleCategorySelect(item.category)}
              >
                <MaterialIcon
                  name={categoryIcons[item.category] || "help-outline"}
                  size={20}
                  color={colors.black}
                />
                <Text style={styles.dropdownText}>{item.label}</Text>
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownList}
          />
        </View>
      )}

      {/* Submit */}
      <Pressable style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit request</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 14,
  },
  title: {
    fontSize: 20,
    color: colors.black,
  },
  inputGroup: {
    gap: 3,
  },
  label: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 50,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "bold",
    color: colors.black,
    padding: 0,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "bold",
    color: colors.black,
  },
  dropdown: {
    borderRadius: 8,
    backgroundColor: colors.grey5,
    maxHeight: 180,
    overflow: "hidden",
  },
  dropdownList: {
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    color: colors.black,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.white,
  },
}))
