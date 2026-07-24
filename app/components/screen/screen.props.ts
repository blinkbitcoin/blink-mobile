import { ViewStyle } from "react-native"
import { Edge } from "react-native-safe-area-context"

import { KeyboardOffsets, ScreenPresets } from "./screen.presets"

export interface ScreenProps {
  /**
   * Children components.
   */
  children?: React.ReactNode

  /**
   * An optional style override useful for padding & margin.
   */
  style?: ViewStyle

  /**
   * One of the different types of presets.
   */
  preset?: ScreenPresets

  /**
   * An optional background color
   */
  backgroundColor?: string

  /**
   * An optional status bar setting. Defaults to light-content.
   */
  statusBar?: "light-content" | "dark-content"

  /**
   * Should we not wrap in SafeAreaView? Defaults to false.
   */
  unsafe?: boolean

  /**
   * Overrides the safe-area edges derived from headerShown. Ignored when unsafe.
   * Tab screens should omit "bottom" — the tab bar already reserves that inset.
   */
  edges?: Edge[]

  headerShown?: boolean

  /**
   * By how much should we offset the keyboard? Defaults to none.
   */
  keyboardOffset?: KeyboardOffsets

  keyboardShouldPersistTaps?: "always" | "never" | "handled"
}
