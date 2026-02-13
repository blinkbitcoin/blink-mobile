import { FC, useMemo, useState, useCallback } from "react"
import { View, ScrollView, TouchableOpacity, Dimensions } from "react-native"
import { CheckBox, makeStyles, Text, useTheme } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"

import MaterialIcon from "react-native-vector-icons/MaterialIcons"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"
import {
  Category,
  categoryI18NNames,
  categoryIcons,
} from "@app/components/map-components/categories.ts"

const { height: screenHeight } = Dimensions.get("window")

type FiltersContentProps = {
  closeModal: () => void
  filters: Set<Category>
  setFilters: (filters: Set<Category>) => void
}

export const FiltersContent: FC<FiltersContentProps> = ({
  closeModal,
  filters,
  setFilters,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const [tempFilters, setTempFilters] = useState(() => new Set(filters))

  const availableCategories = useMemo(() => {
    return Object.keys(categoryI18NNames).map((key) => {
      const category = parseInt(key, 10) as Category
      return {
        category,
        checked: tempFilters.has(category),
      }
    })
  }, [tempFilters])

  const applyAndClose = useCallback(() => {
    setFilters(new Set(tempFilters))
    closeModal()
  }, [tempFilters, setFilters, closeModal])

  const toggleCheck = useCallback((category: Category) => {
    setTempFilters((prev) => {
      const newFilters = new Set(prev)
      if (newFilters.has(category)) {
        newFilters.delete(category)
        return newFilters
      }
      newFilters.add(category)
      return newFilters
    })
  }, [])

  const selectAll = useCallback(() => {
    const allCategories = Object.values(Category).filter(
      (value) => typeof value === "number",
    ) as Category[]
    setTempFilters(new Set(allCategories))
  }, [])

  return (
    <View style={styles.componentWrapper}>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal}>{LL.MapScreen.categoriesFilters()}</Text>
        <Icon
          color="grey"
          name="close"
          size={22}
          style={styles.closeIcon}
          onPress={closeModal}
        />
      </View>

      <Text color="grey">{LL.MapScreen.chooseCategories()}</Text>

      <ScrollView style={styles.contentBox}>
        {availableCategories.map((category) => (
          <View key={category.category} style={styles.listContent}>
            <View style={styles.listCheck}>
              <MaterialIcon
                name={categoryIcons[category.category] || "help-outline"}
                size={22}
                style={styles.listIcon}
              />
              <Text style={styles.titleFilter}>
                {LL.MapScreen.categories[
                  categoryI18NNames[
                    category.category
                  ] as keyof typeof LL.MapScreen.categories
                ]()}
              </Text>
            </View>
            <CheckBox
              checked={category.checked}
              onPress={() => toggleCheck(category.category)}
              containerStyle={styles.checkBox}
              checkedIcon={<Icon name="checkbox" color={colors.primary} size={22} />}
              uncheckedIcon={<Icon name="square-outline" color="grey" size={22} />}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={selectAll}>
          <Text color={colors.primary}>{LL.MapScreen.selectAll()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={applyAndClose}>
          <Text color={colors.primary}>{LL.MapScreen.apply()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
const useStyles = makeStyles(({ colors }) => ({
  componentWrapper: { minHeight: screenHeight - 300, maxHeight: screenHeight - 300 },
  titleContent: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  titleModal: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
  },
  contentBox: {
    paddingTop: 20,
  },
  listContent: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    marginBottom: 10,
  },
  listCheck: {
    alignItems: "center",
    flexDirection: "row",
  },
  titleFilter: {
    fontSize: 15,
  },
  listIcon: {
    color: colors.black,
    paddingRight: 7,
  },
  checkBox: {
    backgroundColor: "transparent",
    padding: 0,
    margin: 0,
    right: -10,
  },
  closeIcon: {
    paddingHorizontal: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
}))
