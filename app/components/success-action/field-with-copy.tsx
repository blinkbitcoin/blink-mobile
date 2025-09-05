import React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import Clipboard from "@react-native-clipboard/clipboard"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { toastShow } from "@app/utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"
import { FielWithCopyProps } from "./field-with-copy.props"

export const FieldWithCopy = ({
  text,
  copiedMessage,
  accessibilityLabel,
}: FielWithCopyProps) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const copyToClipboard = (text: string, message: string) => {
    Clipboard.setString(text)
    toastShow({ type: "success", message, LL })
  }

  return (
    <View style={styles.successActionFieldContainer}>
      <Text style={[styles.truncatedText, styles.disabledFieldBackground]}>{text}</Text>
      <TouchableOpacity
        style={styles.iconContainer}
        onPress={() => copyToClipboard(text, copiedMessage)}
        accessibilityLabel={accessibilityLabel}
        hitSlop={30}
      >
        <GaloyIcon name="copy-paste" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  successActionFieldContainer: {
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    padding: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  disabledFieldBackground: {
    flex: 1,
    opacity: 0.5,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
  truncatedText: {
    fontSize: 14,
    color: colors.grey1,
  },
}))
