import { FC, useMemo, useCallback, useState, useEffect, useRef } from "react"
import { View, ScrollView, Switch, Pressable } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import MaterialIcon from "@react-native-vector-icons/material-icons"
import {
  Category,
  categoryI18NNames,
  categoryIcons,
} from "@app/components/map-components/categories.ts"

type Props = {
  filters: Set<Category>
  setFilters: (filters: Set<Category>) => void
}

export const FiltersCard: FC<Props> = ({ filters, setFilters }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  // Local state for instant toggle animation; applied to parent on unmount
  const [local, setLocal] = useState(() => new Set(filters))
  const localRef = useRef(local)
  localRef.current = local

  const setFiltersRef = useRef(setFilters)
  setFiltersRef.current = setFilters

  // Sync parent filters on unmount only (sheet close)
  useEffect(() => {
    return () => {
      setFiltersRef.current(localRef.current)
    }
  }, [])

  const categoryList = useMemo(() => {
    return Object.keys(categoryI18NNames).map((key) => {
      const category = parseInt(key, 10) as Category
      return { category, label: categoryI18NNames[category] }
    })
  }, [])

  const toggleCategory = useCallback((category: Category) => {
    setLocal((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  const allCategories = useMemo(
    () => Object.values(Category).filter((v) => typeof v === "number") as Category[],
    [],
  )

  const allSelected = local.size === allCategories.length

  const toggleAll = useCallback(() => {
    setLocal(allSelected ? new Set() : new Set(allCategories))
  }, [allSelected, allCategories])

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Categories</Text>
        <Pressable onPress={toggleAll} style={styles.selectAllBadge}>
          <Text style={styles.selectAllText}>
            {allSelected ? "Deselect All" : "Select All"}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {categoryList.map((item, index) => (
          <View key={item.category}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <MaterialIcon
                  name={categoryIcons[item.category] || "help-outline"}
                  size={16}
                  color={colors.black}
                />
                <Text style={styles.rowLabel}>{item.label}</Text>
              </View>
              <Switch
                value={local.has(item.category)}
                onValueChange={() => toggleCategory(item.category)}
                trackColor={{ false: colors.grey4, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            {index < categoryList.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    color: colors.black,
  },
  selectAllBadge: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.black,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
    marginHorizontal: 14,
  },
}))
