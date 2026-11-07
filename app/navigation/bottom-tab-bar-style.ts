import React from "react"
import { StyleProp, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { makeStyles } from "@rn-vui/themed"

/** The bar's own height. The home indicator is cleared on top of it. */
const BAR_HEIGHT = 60

/**
 * The tab bar's style, as a hook rather than an expression written inline in
 * `Tab.Navigator`'s `screenOptions`.
 *
 * A screen that hides the bar has to be able to put it back exactly as it was,
 * and `navigation.setOptions` merges over the navigator's `screenOptions`
 * rather than falling back to them: clearing the key restores a bar with no
 * style at all, not the default one. So both sides read the default from here.
 *
 * @see `map-component`, which hides the bar while a place is being added.
 */
export const useBottomTabBarStyle = (): StyleProp<ViewStyle> => {
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  // Stable across renders: the map screen restores the bar from an effect, and
  // a fresh array every render would re-run it every render.
  return React.useMemo(
    () => [
      styles.bar,
      { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
    ],
    [styles.bar, insets.bottom],
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    paddingTop: 4,
    backgroundColor: colors.white,
    borderTopColor: colors.grey4,
  },
}))
