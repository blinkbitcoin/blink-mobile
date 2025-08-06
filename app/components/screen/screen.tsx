import * as React from "react"
import {
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  View,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useHeaderHeight } from "@react-navigation/elements"

import { ScreenProps } from "./screen.props"
import { isNonScrolling, offsets, presets } from "./screen.presets"
import { ModalClipboard } from "../modal-clipboard"
import { ModalNfc } from "../modal-nfc"
import { isIos } from "../../utils/helper"

function ScreenWithoutScrolling(props: ScreenProps) {
  const preset = presets.fixed
  const style = props.style || {}
  const backgroundStyle = props.backgroundColor
    ? { backgroundColor: props.backgroundColor }
    : {}
  
  let headerHeight = 0
  try {
    headerHeight = useHeaderHeight()
  } catch {
    // No header present
    headerHeight = 0
  }
  
  // If there's a header, only apply bottom safe area. Otherwise apply both.
  const safeAreaEdges = headerHeight > 0 ? ['bottom'] : ['top', 'bottom']

  return (
    <KeyboardAvoidingView
      style={[preset.outer, backgroundStyle]}
      behavior={isIos ? "padding" : null}
      keyboardVerticalOffset={offsets[props.keyboardOffset || "none"]}
    >
      <StatusBar
        barStyle={props.statusBar || "dark-content"}
        backgroundColor={props.backgroundColor}
      />
      {/* modalClipboard requires StoreContext which requiere being inside a navigator */}
      <ModalClipboard />
      <ModalNfc />
      {props.unsafe ? (
        <View style={[preset.inner, style]}>{props.children}</View>
      ) : (
        <SafeAreaView edges={safeAreaEdges} style={[preset.inner, style]}>
          {props.children}
        </SafeAreaView>
      )}
    </KeyboardAvoidingView>
  )
}

function ScreenWithScrolling(props: ScreenProps) {
  const preset = presets.scroll
  const style = props.style || {}
  const backgroundStyle = props.backgroundColor
    ? { backgroundColor: props.backgroundColor }
    : {}
  
  let headerHeight = 0
  try {
    headerHeight = useHeaderHeight()
  } catch {
    // No header present
    headerHeight = 0
  }
  
  // If there's a header, only apply bottom safe area. Otherwise apply both.
  const safeAreaEdges = headerHeight > 0 ? ['bottom'] : ['top', 'bottom']

  return (
    <KeyboardAvoidingView
      style={[preset.outer, backgroundStyle]}
      behavior={isIos ? "padding" : null}
      keyboardVerticalOffset={offsets[props.keyboardOffset || "none"]}
    >
      <StatusBar
        barStyle={props.statusBar || "dark-content"}
        backgroundColor={props.backgroundColor}
      />
      <ModalClipboard />
      <ModalNfc />
      {props.unsafe ? (
        <View style={[preset.outer, backgroundStyle]}>
          <ScrollView
            style={[preset.outer, backgroundStyle]}
            contentContainerStyle={[preset.inner, style]}
          >
            {props.children}
          </ScrollView>
        </View>
      ) : (
        <SafeAreaView edges={safeAreaEdges} style={[preset.outer, backgroundStyle]}>
          <ScrollView
            style={[preset.outer, backgroundStyle]}
            contentContainerStyle={[preset.inner, style]}
          >
            {props.children}
          </ScrollView>
        </SafeAreaView>
      )}
    </KeyboardAvoidingView>
  )
}

/**
 * The starting component on every screen in the app.
 *
 * @param props The screen props
 */
export function Screen(props: ScreenProps): JSX.Element {
  if (isNonScrolling(props.preset)) {
    return <ScreenWithoutScrolling {...props} />
  }
  return <ScreenWithScrolling {...props} />
}
