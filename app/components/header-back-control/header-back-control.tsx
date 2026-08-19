import React from "react"
import { Platform, View } from "react-native"
import { HeaderBackButton } from "@react-navigation/elements"
import { useNavigation } from "@react-navigation/native"
import { NativeStackHeaderBackProps } from "@react-navigation/native-stack"
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

/**
 * The render function handed to `headerLeft` must never call hooks itself, which is why
 * it returns an element instead of the button component: native-stack invokes
 * `headerLeft` inline while it computes the header config (useHeaderConfigProps, called
 * from SceneView, the per-screen child NativeStackView renders around each route), so
 * hooks called there land on that fiber rather than on the button's. Any screen that then
 * replaces `headerLeft` with a hookless render (the KYC webview, the account-delete flow)
 * leaves that fiber rendering fewer hooks than the previous pass, which throws "Rendered
 * fewer hooks than expected" and drops the whole navigation tree into the app-wide error
 * boundary (#4176).
 */
export const headerBackControl = ({ canGoBack = true }: HeaderBackControlParams = {}) => {
  const HeaderBack = (props: NativeStackHeaderBackProps): React.ReactNode =>
    canGoBack ? <HeaderBackButtonWithTheme {...props} /> : <InvisibleBackButton />

  return HeaderBack
}

/** The platform check sits inside the factory rather than in a module constant so the
 *  spec can vary `Platform.OS` per case without re-importing the module. makeStyles
 *  memoizes per hook instance, so a fresh render always re-reads it. */
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
