import React from "react"
import { View } from "react-native"
import { HeaderBackButton } from "@react-navigation/elements"
import { makeStyles, useTheme } from "@rn-vui/themed"

export const InvisibleBackButton = (): React.ReactNode => {
  const styles = useStyles()
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <HeaderBackButton onPress={() => {}} />
    </View>
  )
}

type HeaderBackControlParams = {
  canGoBack?: boolean
}

const HeaderBackButtonWithTheme = (
  props: React.ComponentProps<typeof HeaderBackButton>,
): React.ReactNode => {
  const {
    theme: { colors },
  } = useTheme()
  return <HeaderBackButton {...props} pressColor={colors.grey5} pressOpacity={1} />
}

export const headerBackControl = ({ canGoBack = true }: HeaderBackControlParams = {}) =>
  canGoBack ? HeaderBackButtonWithTheme : InvisibleBackButton

const useStyles = makeStyles(() => ({
  container: {
    opacity: 0,
  },
}))
