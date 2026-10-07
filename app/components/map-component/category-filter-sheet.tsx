import React from "react"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PLACE_CATEGORIES, PlaceCategory } from "@app/btcmap"
import { Switch } from "@app/components/atomic/switch"
import { BottomSheet } from "@app/components/bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

// Tall enough that the list reads as a list, short enough that the map it is
// filtering stays visible behind it.
const SHEET_RATIO = 0.6

type Props = {
  isVisible: boolean
  selected: ReadonlySet<PlaceCategory>
  onChange: (categories: ReadonlySet<PlaceCategory>) => void
  onClose: () => void
}

/**
 * The category filter.
 *
 * Nothing switched on means no filter rather than no places — see
 * `placesInCategories`. That is what makes "clear all" a way back to the whole
 * map instead of a way to empty it, and it is why the sheet opens with every
 * toggle off rather than every toggle on.
 *
 * One resting position: the list is the whole point of it, so there is nothing
 * a peek would usefully show short of it.
 */
export const CategoryFilterSheet: React.FC<Props> = ({
  isVisible,
  selected,
  onChange,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ bottomInset: insets.bottom })

  const toggle = (category: PlaceCategory) => {
    const next = new Set(selected)
    if (!next.delete(category)) next.add(category)
    onChange(next)
  }

  const areAllSelected = selected.size === PLACE_CATEGORIES.length

  return (
    <BottomSheet
      testID="category-filter-sheet"
      isVisible={isVisible}
      onClose={onClose}
      heightRatio={SHEET_RATIO}
      headerStyle={styles.header}
      contentContainerStyle={styles.listContent}
      header={
        <>
          <Text style={styles.title}>{LL.MapScreen.categories()}</Text>
          <Pressable
            testID="toggle-all-categories"
            onPress={() =>
              onChange(areAllSelected ? new Set() : new Set(PLACE_CATEGORIES))
            }
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.action}>
              {areAllSelected ? LL.MapScreen.clearAll() : LL.MapScreen.selectAll()}
            </Text>
          </Pressable>
        </>
      }
    >
      {PLACE_CATEGORIES.map((category) => (
        <View key={category} style={styles.row}>
          <Text style={styles.rowLabel}>{LL.MapScreen.category[category]()}</Text>
          <Switch
            testID={`category-${category}`}
            accessibilityLabel={LL.MapScreen.category[category]()}
            value={selected.has(category)}
            onValueChange={() => toggle(category)}
          />
        </View>
      ))}
    </BottomSheet>
  )
}

const useStyles = makeStyles(({ colors }, { bottomInset }: { bottomInset: number }) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.black,
  },
  action: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: bottomInset + 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey5,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
  },
}))
