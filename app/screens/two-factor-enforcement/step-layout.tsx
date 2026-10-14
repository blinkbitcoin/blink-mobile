import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"

type StepLayoutProps = {
  children: React.ReactNode
  footer: React.ReactNode
  /** A row the screen draws itself, for a screen whose navigation header is hidden. */
  header?: React.ReactNode
  headerShown?: boolean
}

export const StepLayout: React.FC<StepLayoutProps> = ({
  children,
  footer,
  header,
  headerShown,
}) => {
  const styles = useStyles()

  return (
    <Screen preset="fixed" headerShown={headerShown}>
      <View style={styles.container}>
        <View>
          {header}
          <View style={styles.body}>{children}</View>
        </View>
        <View style={styles.footer}>{footer}</View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  body: {
    paddingTop: 10,
  },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
}))
