import React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { headerRightNoGlass } from "../header-no-glass"

type HeaderCloseControlParams = {
  navigateTo?: keyof RootStackParamList
  /** Replaces the navigation, for a screen that closes back to wherever it was opened
   *  from rather than to a fixed route. */
  onPress?: () => void
}

/** The options above resolve the route, so the button itself takes no default. */
type HeaderCloseButtonProps = HeaderCloseControlParams & {
  navigateTo: keyof RootStackParamList
}

const HeaderCloseButton: React.FC<HeaderCloseButtonProps> = ({ navigateTo, onPress }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handlePress = onPress ?? (() => navigation.navigate(navigateTo as never))

  return (
    <GaloyIconButton
      onPress={handlePress}
      size="medium"
      name="close"
      backgroundColor={colors.grey5}
      style={styles.headerCloseButton}
    />
  )
}

// Spread into a screen's `options` to render the close button without the iOS 26
// Liquid Glass shared background. See header-no-glass.tsx. Intentionally the only
// export: a bare `headerRight: <close button>` would get the glass capsule back.
export const headerCloseControlOptions = ({
  navigateTo = "Primary",
  onPress,
}: HeaderCloseControlParams = {}) =>
  headerRightNoGlass(() => (
    <HeaderCloseButton navigateTo={navigateTo} onPress={onPress} />
  ))

const useStyles = makeStyles(() => ({
  headerCloseButton: {
    marginRight: 20,
  },
}))
