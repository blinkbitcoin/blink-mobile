import * as React from "react"
import { KeyboardAvoidingView, StatusBar, View, SafeAreaView } from "react-native"
import { ScrollView } from "react-native-gesture-handler"

import { useTheme } from "@rneui/themed"

import { isIos } from "../../utils/helper"
import { isNonScrolling, offsets, presets } from "./screen.presets"
import { ScreenProps } from "./screen.props"

function ScreenWithoutScrolling(props: ScreenProps) {
  const {
    theme: { mode, colors },
  } = useTheme()

  const statusBarContent = mode === "light" ? "dark-content" : "light-content"

  const preset = presets.fixed
  const style = props.style || {}
  const backgroundStyle = props.backgroundColor
    ? { backgroundColor: props.backgroundColor }
    : { backgroundColor: colors.white }
  const Wrapper = props.unsafe ? View : SafeAreaView

  return (
    <KeyboardAvoidingView
      style={[preset.outer, backgroundStyle]}
      behavior={isIos ? "padding" : undefined}
      keyboardVerticalOffset={offsets[props.keyboardOffset || "none"]}
    >
      <StatusBar
        barStyle={props.statusBar || statusBarContent}
        backgroundColor={colors.white}
      />
      <Wrapper style={[preset.inner, style]}>{props.children}</Wrapper>
    </KeyboardAvoidingView>
  )
}

function ScreenWithScrolling(props: ScreenProps) {
  const {
    theme: { mode, colors },
  } = useTheme()

  const statusBarContent = mode === "light" ? "dark-content" : "light-content"

  const preset = presets.scroll
  const style = props.style || {}
  const backgroundStyle = props.backgroundColor
    ? { backgroundColor: props.backgroundColor }
    : { backgroundColor: colors.white }
  const Wrapper = props.unsafe ? View : SafeAreaView

  return (
    <KeyboardAvoidingView
      style={[preset.outer, backgroundStyle]}
      behavior={isIos ? "padding" : undefined}
      keyboardVerticalOffset={offsets[props.keyboardOffset || "none"]}
    >
      <StatusBar
        barStyle={props.statusBar || statusBarContent}
        backgroundColor={colors.white}
      />
      <Wrapper style={[preset.outer, backgroundStyle]}>
        <ScrollView
          {...props}
          style={[preset.outer, backgroundStyle]}
          contentContainerStyle={[preset.inner, style]}
          keyboardShouldPersistTaps={props.keyboardShouldPersistTaps}
        >
          {props.children}
        </ScrollView>
      </Wrapper>
    </KeyboardAvoidingView>
  )
}

/**
 * The starting component on every screen in the app.
 *
 * @param props The screen props
 */
export const Screen: React.FC<ScreenProps> = (props) => {
  if (isNonScrolling(props.preset)) {
    return <ScreenWithoutScrolling {...props} />
  }
  return <ScreenWithScrolling {...props} />
}
