import React from "react"
import { StyleProp, View, ViewStyle } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"

type MigrationStepLayoutProps = {
  children: React.ReactNode
  footer: React.ReactNode
  header?: React.ReactNode
  headerShown?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * The migration flow's shared step scaffold: an optional header row, the step content,
 * and the footer actions pinned to the bottom with the flow's spacing.
 */
export const MigrationStepLayout: React.FC<MigrationStepLayoutProps> = ({
  children,
  footer,
  header,
  headerShown,
  contentStyle,
}) => {
  const styles = useStyles()

  return (
    <Screen preset="fixed" headerShown={headerShown}>
      <View style={styles.container}>
        {header}
        <View style={[styles.content, contentStyle]}>{children}</View>
        <View style={styles.buttonsContainer}>{footer}</View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
