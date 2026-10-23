import * as React from "react"
import { Platform, Pressable, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Toast, { ToastConfigParams } from "react-native-toast-message"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import { modalContentBleed, toastSideInset, toastTopOffset } from "./toast-frame"

export type ToastType = "success" | "error" | "warning"

const icons: Record<ToastType, IconNamesType> = {
  success: "check-circle",
  error: "warning-circle",
  warning: "warning",
}

type ToastRowProps = {
  type: ToastType
  text1?: string
  text2?: string
  onPress?: () => void
  hide?: () => void
}

const ToastRow = ({ type, text1, text2, onPress, hide }: ToastRowProps) => {
  const {
    theme: { colors },
  } = useTheme()
  const { width } = useWindowDimensions()
  const { left, right } = useSafeAreaInsets()
  const accent = {
    success: colors._green,
    error: colors.red,
    warning: colors.warning,
  }[type]
  const styles = useStyles({ accent, ...toastSideInset(width, left, right) })

  return (
    // The title is not drawn, the icon and colour carry the type, so it is
    // announced instead, and shown only when there is no message to show.
    <Pressable
      testID={`toast-${type}`}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={[text1, text2].filter(Boolean).join(". ")}
      style={styles.container}
      onPress={() => {
        onPress?.()
        hide?.()
      }}
    >
      <GaloyIcon name={icons[type]} size={18} color={accent} />
      <Text style={styles.text}>{text2 || text1}</Text>
    </Pressable>
  )
}

const toastConfig = {
  success: ({ text1, text2, onPress, hide }: ToastConfigParams<unknown>) => (
    <ToastRow type="success" text1={text1} text2={text2} onPress={onPress} hide={hide} />
  ),
  error: ({ text1, text2, onPress, hide }: ToastConfigParams<unknown>) => (
    <ToastRow type="error" text1={text1} text2={text2} onPress={onPress} hide={hide} />
  ),
  warning: ({ text1, text2, onPress, hide }: ToastConfigParams<unknown>) => (
    <ToastRow type="warning" text1={text1} text2={text2} onPress={onPress} hide={hide} />
  ),
}

type Props = {
  // Set on the invite and challenge modals. Their content box is inset by a
  // percent of the window; the toast has to sit in the window, not that box.
  inModal?: boolean
}

export const GaloyToast = ({ inModal = false }: Props) => {
  const { top } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const bleed = modalContentBleed(width, inModal)
  const toast = (
    <Toast
      config={toastConfig}
      topOffset={toastTopOffset({ safeTop: top, inModal, platform: Platform.OS })}
    />
  )

  if (!inModal) return toast

  return (
    <View
      testID="toast-host"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: -bleed,
        left: -bleed,
        right: -bleed,
        bottom: -bleed,
      }}
    >
      {toast}
    </View>
  )
}

const useStyles = makeStyles(
  (
    { colors },
    {
      accent,
      marginLeft,
      marginRight,
    }: { accent: string; marginLeft: number; marginRight: number },
  ) => ({
    container: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginLeft,
      marginRight,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: accent,
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
  }),
)
