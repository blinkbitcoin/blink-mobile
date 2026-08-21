import React from "react"
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PLACE_CATEGORIES, PlaceCategory } from "@app/btcmap"
import { Switch } from "@app/components/atomic/switch"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

const SCRIM_COLOR = "rgba(0, 0, 0, 0.4)"
const SLIDE_DURATION_MS = 220

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
 */
export const CategoryFilterSheet: React.FC<Props> = ({
  isVisible,
  selected,
  onChange,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const styles = useStyles({ bottomInset: insets.bottom })

  const sheetHeight = Math.round(windowHeight * SHEET_RATIO)
  const offset = useSharedValue(sheetHeight)

  React.useEffect(() => {
    offset.value = withTiming(isVisible ? 0 : sheetHeight, {
      duration: SLIDE_DURATION_MS,
    })
  }, [isVisible, sheetHeight, offset])

  // The dependency array is passed explicitly rather than left to the Babel
  // plugin to infer, so this still works where it is not applied — the test
  // environment among them.
  const sheetStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: offset.value }] }),
    [offset],
  )

  const toggle = (category: PlaceCategory) => {
    const next = new Set(selected)
    if (!next.delete(category)) next.add(category)
    onChange(next)
  }

  const areAllSelected = selected.size === PLACE_CATEGORIES.length

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={LL.common.close()}
        />

        <Animated.View
          testID="category-filter-sheet"
          style={[styles.sheet, { height: sheetHeight }, sheetStyle]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
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
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }, { bottomInset }: { bottomInset: number }) => ({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // A scrim has to darken in both themes; the theme's backdrop tokens invert
    // and would brighten the map behind the sheet in dark mode.
    backgroundColor: SCRIM_COLOR,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginBottom: 8,
  },
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
  list: {
    flex: 1,
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
