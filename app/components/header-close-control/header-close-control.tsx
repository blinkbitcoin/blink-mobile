import React from "react"
import { StackActions, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { HEADER_ICON_BUTTON_TOUCH_PADDING, headerRightNoGlass } from "../header-no-glass"

type HeaderCloseControlParams = {
  navigateTo?: keyof RootStackParamList
  /** Pops back to `navigateTo` instead of navigating to it. A screen that ends a flow
   *  closes onto the Home already under it, since navigating stacks a second one. */
  shouldPopTo?: boolean
}

/** The native header already insets its right item by 16 on both platforms (Android
 *  mirrors its start inset to the end to match iOS), and the design keeps the circle 20
 *  from the edge. So the 48dp box leaves the circle only the remaining 4 on its right and
 *  takes the rest on its left, instead of reaching past the inset with a negative margin. */
const HEADER_RIGHT_NATIVE_INSET = 16
const DESIGN_EDGE_INSET = 20
const CLOSE_RIGHT_TOUCH_PADDING = DESIGN_EDGE_INSET - HEADER_RIGHT_NATIVE_INSET
const CLOSE_TOUCH_PADDING = {
  top: HEADER_ICON_BUTTON_TOUCH_PADDING,
  bottom: HEADER_ICON_BUTTON_TOUCH_PADDING,
  right: CLOSE_RIGHT_TOUCH_PADDING,
  left: HEADER_ICON_BUTTON_TOUCH_PADDING * 2 - CLOSE_RIGHT_TOUCH_PADDING,
}

const HeaderCloseButton: React.FC<Required<HeaderCloseControlParams>> = ({
  navigateTo,
  shouldPopTo,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const close = () => {
    if (shouldPopTo) {
      navigation.dispatch(StackActions.popTo(navigateTo))
      return
    }
    navigation.navigate(navigateTo as never)
  }

  return (
    <GaloyIconButton
      onPress={close}
      size="medium"
      name="close"
      backgroundColor={colors.surfaceInteractive}
      touchPadding={CLOSE_TOUCH_PADDING}
    />
  )
}

// Spread into a screen's `options` to render the close button without the iOS 26
// Liquid Glass shared background. See header-no-glass.tsx. Intentionally the only
// export: a bare `headerRight: <close button>` would get the glass capsule back.
export const headerCloseControlOptions = ({
  navigateTo = "Primary",
  shouldPopTo = false,
}: HeaderCloseControlParams = {}) =>
  headerRightNoGlass(() => (
    <HeaderCloseButton navigateTo={navigateTo} shouldPopTo={shouldPopTo} />
  ))
