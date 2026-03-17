import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  TextInput,
  View,
} from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import MaterialIcon, {
  MaterialIconsIconName,
} from "@react-native-vector-icons/material-icons"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import {
  Category,
  categoryI18NNames,
  categoryIcons,
} from "@app/components/map-components/categories.ts"

type Props = {
  closeModal: () => void
  mapCenter: { latitude: number; longitude: number }
}

export const SuggestBusinessCard: FC<Props> = ({ closeModal, mapCenter }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const userEditedAddress = useRef(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState("")
  const searchInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (userEditedAddress.current) return
    setAddress(`${mapCenter.latitude.toFixed(6)}, ${mapCenter.longitude.toFixed(6)}`)
  }, [mapCenter.latitude, mapCenter.longitude])

  const allCategoryList = useMemo(() => {
    return Object.keys(categoryI18NNames).map((key) => {
      const cat = parseInt(key, 10) as Category
      return { category: cat, label: categoryI18NNames[cat] }
    })
  }, [])

  const filteredCategoryList = useMemo(() => {
    if (!categorySearch.trim()) return allCategoryList
    return allCategoryList.filter((item) =>
      item.label.toLowerCase().includes(categorySearch.toLowerCase()),
    )
  }, [allCategoryList, categorySearch])

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
    setCategorySearch("")
  }, [])

  const handleClosePicker = useCallback(() => {
    setCategoryPickerOpen(false)
    setCategorySearch("")
  }, [])

  const selectedLabel = selectedCategory
    ? categoryI18NNames[selectedCategory]
    : "Choose a category"

  const renderCategoryItem = useCallback(
    ({ item }: { item: { category: Category; label: string } }) => (
      <Pressable
        style={styles.pickerItem}
        onPress={() => handleCategorySelect(item.category)}
      >
        <MaterialIcon
          name={(categoryIcons[item.category] as MaterialIconsIconName) || "help-outline"}
          size={22}
          color={colors.black}
        />
        <Text style={styles.pickerItemLabel}>{item.label}</Text>
        {selectedCategory === item.category && (
          <GaloyIcon name="check" size={18} color={colors.primary} />
        )}
      </Pressable>
    ),
    [handleCategorySelect, selectedCategory, colors, styles],
  )

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
          onPress={() => setCategoryPickerOpen(true)}
        >
          <Text style={[styles.inputText, !selectedCategory && { color: colors.grey2 }]}>
            {selectedLabel}
          </Text>
          <GaloyIcon name="caret-down" size={16} color={colors.grey2} />
        </Pressable>
      </View>

      {/* Submit */}
      <Pressable style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit request</Text>
      </Pressable>

      {/* Full-screen category picker */}
      <Modal
        visible={categoryPickerOpen}
        animationType="slide"
        onRequestClose={handleClosePicker}
      >
        <View style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Category</Text>
            <Pressable onPress={handleClosePicker} hitSlop={12}>
              <GaloyIcon name="close" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.pickerSearchContainer}>
            <GaloyIcon name="magnifying-glass" size={16} color={colors.grey2} />
            <TextInput
              ref={searchInputRef}
              style={styles.pickerSearchInput}
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Search"
              placeholderTextColor={colors.grey2}
              autoCorrect={false}
              returnKeyType="search"
            />
            {categorySearch.length > 0 && (
              <Pressable onPress={() => setCategorySearch("")} hitSlop={12}>
                <GaloyIcon name="close" size={14} color={colors.grey2} />
              </Pressable>
            )}
          </View>

          {/* Category list */}
          <FlatList
            data={filteredCategoryList}
            keyExtractor={(item) => String(item.category)}
            renderItem={renderCategoryItem}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.pickerDivider} />}
          />
        </View>
      </Modal>
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
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight ?? 0,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.black,
  },
  pickerSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },

  pickerSearchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    padding: 0,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  pickerItemLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: colors.grey5,
    marginLeft: 52,
  },
}))
