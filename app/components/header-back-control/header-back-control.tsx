import React from "react"
import { Platform, View } from "react-native"
import { HeaderBackButton } from "@react-navigation/elements"
import { useNavigation } from "@react-navigation/native"
import { makeStyles, useTheme } from "@rn-vui/themed"

// native-stack wraps headerLeft in react-native-screens' ScreenStackHeaderLeftView,
// which applies its own standard leading inset (~16dp on Android). The elements
// HeaderBackButton was tuned for the old JS stack (no such inset), so it now sits
// ~10px too far right. Pull it back on Android to restore the previous position.
// (Migration to native-stack: PR #3840 / commit 4b6bff263.)
const ANDROID_BACK_BUTTON_INSET_CORRECTION = -10

export const InvisibleBackButton = (): React.ReactNode => {
  const styles = useStyles()
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <HeaderBackButton style={styles.backButton} />
    </View>
  )
}

type HeaderBackControlParams = {
  canGoBack?: boolean
}

const HeaderBackButtonWithTheme = (
  props: React.ComponentProps<typeof HeaderBackButton>,
): React.ReactNode => {
  const navigation = useNavigation()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  return (
    <HeaderBackButton
      {...props}
      onPress={() => navigation.goBack()}
      pressColor={colors.grey5}
      pressOpacity={1}
      style={styles.backButton}
    />
  )
}

export const headerBackControl = ({ canGoBack = true }: HeaderBackControlParams = {}) =>
  canGoBack ? HeaderBackButtonWithTheme : InvisibleBackButton

const useStyles = makeStyles(() => {
  const isAndroid = Platform.OS === "android"
  const backButtonInsetCorrection = isAndroid ? ANDROID_BACK_BUTTON_INSET_CORRECTION : 0

  return {
    container: {
      opacity: 0,
    },
    backButton: {
      marginLeft: backButtonInsetCorrection,
    },
  }
})
