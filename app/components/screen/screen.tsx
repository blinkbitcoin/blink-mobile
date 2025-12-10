import * as React from "react"
import { KeyboardAvoidingView, StatusBar, View } from "react-native"
import { SafeAreaView, Edge } from "react-native-safe-area-context"
import { ScrollView } from "react-native-gesture-handler"

import { useTheme } from "@rn-vui/themed"

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

  const edges: Edge[] | undefined = props.unsafe
    ? undefined
    : props.headerShown === false
      ? ["top", "left", "right", "bottom"]
      : ["left", "right", "bottom"]

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
      <Wrapper style={[preset.inner, style]} edges={edges}>
        {props.children}
      </Wrapper>
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

  const edges: Edge[] | undefined = props.unsafe
    ? undefined
    : props.headerShown === false
      ? ["top", "left", "right", "bottom"]
      : ["left", "right", "bottom"]

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
      <Wrapper style={[preset.outer, backgroundStyle]} edges={edges}>
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
