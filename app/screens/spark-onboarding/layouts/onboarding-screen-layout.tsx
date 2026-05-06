import React from "react"
import { ScrollView, View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"

type OnboardingScreenLayoutProps = {
  children: React.ReactNode
  footer?: React.ReactNode
  scrollable?: boolean
  keyboardShouldPersistTaps?: "handled" | "always" | "never"
}

export const OnboardingScreenLayout: React.FC<OnboardingScreenLayoutProps> = ({
  children,
  footer,
  scrollable = false,
  keyboardShouldPersistTaps,
}) => {
  const styles = useStyles()

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.body}>{children}</View>
  )

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        {content}
        {footer && <View style={styles.footer}>{footer}</View>}
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
