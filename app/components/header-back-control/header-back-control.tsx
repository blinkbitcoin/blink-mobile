import React from "react"
import { View } from "react-native"
import { HeaderBackButton } from "@react-navigation/elements"
import { makeStyles } from "@rn-vui/themed"

export const InvisibleBackButton: React.FC = () => {
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

export const headerBackControl = ({ canGoBack = true }: HeaderBackControlParams = {}) =>
  canGoBack ? undefined : () => <InvisibleBackButton />

const useStyles = makeStyles(() => ({
  container: {
    opacity: 0,
  },
}))
