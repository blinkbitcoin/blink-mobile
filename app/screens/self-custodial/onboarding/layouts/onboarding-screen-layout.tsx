import React, { useContext } from "react"
import { ScrollView, View } from "react-native"

import { HeaderHeightContext } from "@react-navigation/elements"
import { Edge } from "react-native-safe-area-context"
import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { useKeyboardVisible } from "@app/hooks/use-keyboard-visible"
import { isIos } from "@app/utils/helper"

type OnboardingScreenLayoutProps = {
  children: React.ReactNode
  footer?: React.ReactNode
  scrollable?: boolean
  keyboardShouldPersistTaps?: "handled" | "always" | "never"
  /** Add when the screen has no navigation header, so the top safe-area inset applies. */
  headerless?: boolean
  /** Lift the content and footer above the keyboard, as the send amount screen does, for
   *  screens with text fields low enough for the keyboard to cover. */
  avoidKeyboard?: boolean
}

const keyboardEdges = (headerless: boolean): Edge[] =>
  headerless ? ["top", "left", "right"] : ["left", "right"]

export const OnboardingScreenLayout: React.FC<OnboardingScreenLayoutProps> = ({
  children,
  footer,
  scrollable = false,
  keyboardShouldPersistTaps,
  headerless = false,
  avoidKeyboard = false,
}) => {
  const styles = useStyles()
  const headerShown = headerless ? false : undefined
  const headerHeight = useContext(HeaderHeightContext)
  const isKeyboardVisible = useKeyboardVisible()

  /** Android reports a closed keyboard as a keyboard change, which leaves a stale lift;
   *  iOS settles back by itself and needs the lift on as the keyboard starts to move.
   *  The bottom inset goes while the keyboard covers it. */
  const keyboardProps = avoidKeyboard
    ? {
        keyboardOffset: "navigationHeader" as const,
        keyboardVerticalOffset: headerHeight,
        avoidKeyboardOnAndroid: true,
        avoidKeyboardEnabled: isIos || isKeyboardVisible,
        edges: isKeyboardVisible ? keyboardEdges(headerless) : undefined,
      }
    : {}

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
    <Screen preset="fixed" headerShown={headerShown} {...keyboardProps}>
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
