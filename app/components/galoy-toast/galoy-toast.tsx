import * as React from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Toast, { ToastConfigParams } from "react-native-toast-message"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"

export const TOAST_TOP_OFFSET = 40
export const TOAST_HORIZONTAL_INSET = 20

type ToastType = "success" | "error" | "warning"

const icons: Record<ToastType, IconNamesType> = {
  success: "check-circle",
  error: "warning-circle",
  warning: "warning",
}

type ToastRowProps = { type: ToastType; text1?: string; text2?: string }

const ToastRow = ({ type, text1, text2 }: ToastRowProps) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const accent = {
    success: colors._green,
    error: colors.red,
    warning: colors.warning,
  }[type]

  return (
    // The title is not drawn, the icon and colour carry the type, so it is
    // announced instead, and shown only when there is no message to show.
    <View
      testID={`toast-${type}`}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={[text1, text2].filter(Boolean).join(". ")}
      style={[styles.container, { borderColor: accent }]}
    >
      <GaloyIcon name={icons[type]} size={18} color={accent} />
      <Text style={styles.text}>{text2 || text1}</Text>
    </View>
  )
}

const toastConfig = {
  success: ({ text1, text2 }: ToastConfigParams<unknown>) => (
    <ToastRow type="success" text1={text1} text2={text2} />
  ),
  error: ({ text1, text2 }: ToastConfigParams<unknown>) => (
    <ToastRow type="error" text1={text1} text2={text2} />
  ),
  warning: ({ text1, text2 }: ToastConfigParams<unknown>) => (
    <ToastRow type="warning" text1={text1} text2={text2} />
  ),
}

export const GaloyToast = () => {
  const { top } = useSafeAreaInsets()

  return <Toast config={toastConfig} topOffset={top + TOAST_TOP_OFFSET} />
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: TOAST_HORIZONTAL_INSET,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.grey7,
  },
  text: {
    // Always bold, via the Bold face itself and no fontWeight. Android resolves
    // fontFamily to assets/fonts/<name>.ttf, so "Source Sans Pro" falls back to
    // Roboto there, and the theme's Regular face plus a weight is synthesised.
    flex: 1,
    color: colors.black,
    fontFamily: "SourceSansPro-Bold",
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
}))
