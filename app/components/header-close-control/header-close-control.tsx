import React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { HEADER_ICON_BUTTON_TOUCH_PADDING, headerRightNoGlass } from "../header-no-glass"

type HeaderCloseControlParams = {
  navigateTo?: keyof RootStackParamList
}

const HeaderCloseButton: React.FC<HeaderCloseControlParams> = ({
  navigateTo = "Primary",
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <GaloyIconButton
      onPress={() => navigation.navigate(navigateTo as never)}
      size="medium"
      name="close"
      backgroundColor={colors.grey5}
      style={styles.headerCloseButton}
      touchPadding={HEADER_ICON_BUTTON_TOUCH_PADDING}
    />
  )
}

// Spread into a screen's `options` to render the close button without the iOS 26
// Liquid Glass shared background. See header-no-glass.tsx. Intentionally the only
// export: a bare `headerRight: <close button>` would get the glass capsule back.
export const headerCloseControlOptions = ({
  navigateTo = "Primary",
}: HeaderCloseControlParams = {}) =>
  headerRightNoGlass(() => <HeaderCloseButton navigateTo={navigateTo} />)

const useStyles = makeStyles(() => ({
  // The 48dp box puts the 34dp circle 7dp in from its right edge: the margin gives
  // those 7dp back, so the circle stays 20dp from the screen edge.
  headerCloseButton: {
    marginRight: 20 - HEADER_ICON_BUTTON_TOUCH_PADDING,
  },
}))
