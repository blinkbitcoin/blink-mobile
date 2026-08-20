import React from "react"
import { Pressable, View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

const CONTROL_HEIGHT = 44
const TOP_GAP = 12

/** Where the bar ends, for anything else that has to be drawn under it. */
export const searchBarBottom = (topInset: number): number =>
  topInset + TOP_GAP + CONTROL_HEIGHT

type Props = {
  // The screen hands the whole top edge to the map, so this bar reserves its own.
  topInset: number
  onSearchPress: () => void
  onFilterPress: () => void
  /** Whether any category is switched on, i.e. whether the map is showing less
   * than everything. */
  isFiltered: boolean
}

/**
 * The two controls that sit over the map: a field that opens the search, and the
 * button that opens the category filter.
 *
 * The field is a button, not an input. Typing has to happen over a full screen
 * of results with the keyboard up, and a field that focuses in place would leave
 * the list it is filtering behind the keyboard.
 */
export const MapSearchBar: React.FC<Props> = ({
  topInset,
  onSearchPress,
  onFilterPress,
  isFiltered,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const styles = useStyles({ topInset })

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        testID="open-place-search"
        style={styles.field}
        onPress={onSearchPress}
        accessibilityRole="search"
        accessibilityLabel={LL.common.search()}
      >
        <Text style={styles.placeholder}>{LL.common.search()}</Text>
        <GaloyIcon name="magnifying-glass" size={20} color={colors.primary} />
      </Pressable>

      <Pressable
        testID="open-category-filter"
        style={[styles.filter, isFiltered && styles.filterActive]}
        onPress={onFilterPress}
        accessibilityRole="button"
        accessibilityLabel={LL.MapScreen.filters()}
        // So the map behind it can say whether it is currently showing
        // everything, rather than the state living only in the tint.
        accessibilityState={{ selected: isFiltered }}
      >
        {/* Bold, because the design's dots are chunkier than a regular-weight
            Phosphor set draws them, and three small dots are easy to lose
            against a map. */}
        <GaloyIcon
          name="ellipsis"
          size={22}
          weight="bold"
          color={isFiltered ? colors.white : colors.primary}
        />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { topInset }: { topInset: number }) => ({
  bar: {
    position: "absolute",
    top: topInset + TOP_GAP,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  // Both controls float over the map, so both carry the same lift. shadow* is
  // iOS-only and elevation is Android-only; the map needs them on both.
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    minHeight: CONTROL_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: CONTROL_HEIGHT / 2,
    backgroundColor: colors.white,
    shadowColor: colors._black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    color: colors.grey2,
  },
  filter: {
    width: CONTROL_HEIGHT,
    height: CONTROL_HEIGHT,
    // A circle, on the same radius rule as the field beside it, so the pair
    // reads as two controls of one family rather than a pill and a tile.
    borderRadius: CONTROL_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    shadowColor: colors._black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  filterActive: {
    backgroundColor: colors.primary,
  },
}))
