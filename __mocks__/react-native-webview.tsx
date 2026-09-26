import React from "react"
import { View } from "react-native"

/**
 * The real module reaches for the RNCWebViewModule turbo module at import time,
 * which no test environment provides. Screens that only happen to pull a WebView
 * in through a barrel would fail to load without this; a screen that actually
 * exercises WebView behaviour overrides it with its own jest.mock.
 */
type Props = { children?: React.ReactNode } & Record<string, unknown>

export const WebView = ({ children, ...props }: Props) => (
  <View {...props}>{children}</View>
)

export default WebView
