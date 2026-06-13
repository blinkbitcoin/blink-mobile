import React from "react"

import { NativeStackNavigationOptions } from "@react-navigation/native-stack"

/**
 * iOS 26 wraps custom navigation-bar button items in a "Liquid Glass" shared
 * background. Setting `hidesSharedBackground` on the bar button item opts it out.
 *
 * The `unstable_header*Items` options are the only way to reach that native
 * property through native-stack, and they are honored on iOS only — on Android
 * they are ignored and the header falls back to `headerLeft`/`headerRight`. So we
 * emit both: the plain render for Android, and the opted-out item for iOS.
 *
 * Centralized here so the eventual rename of the `unstable_` options lands in one
 * place instead of every screen.
 *
 * See https://developer.apple.com/documentation/uikit/uibarbuttonitem/hidessharedbackground
 */

type RenderItem = () => React.ReactElement

export const headerRightNoGlass = (
  render: RenderItem,
): Partial<NativeStackNavigationOptions> => ({
  headerRight: render,
  // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
  unstable_headerRightItems: () => [
    { type: "custom", element: render(), hidesSharedBackground: true },
  ],
})

export const headerLeftNoGlass = (
  render: RenderItem,
): Partial<NativeStackNavigationOptions> => ({
  headerLeft: render,
  // eslint-disable-next-line camelcase -- name dictated by @react-navigation/native-stack
  unstable_headerLeftItems: () => [
    { type: "custom", element: render(), hidesSharedBackground: true },
  ],
})
