import React from "react"
import { View } from "react-native"
import { HeaderBackButton } from "@react-navigation/elements"
import { makeStyles, useTheme } from "@rn-vui/themed"

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
  canGoBack
    ? (props: React.ComponentProps<typeof HeaderBackButton>) => {
        const {
          theme: { colors },
        } = useTheme()
        return <HeaderBackButton {...props} pressColor={colors.grey5} pressOpacity={1} />
      }
    : () => <InvisibleBackButton />

const useStyles = makeStyles(() => ({
  container: {
    opacity: 0,
  },
}))
