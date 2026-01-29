import React from "react"
import { View, TouchableOpacity, StyleSheet } from "react-native"
import { Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"

type Props = {
  secret: string
}

export const CopySecretComponent: React.FC<Props> = ({ secret }) => {
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text type="p2">{LL.TotpRegistrationInitiateScreen.secret()}</Text>
        <TouchableOpacity
          style={[styles.secretContainer, { backgroundColor: colors.grey5 }]}
          onPress={() =>
            copyToClipboard({
              content: secret,
              message: LL.CopySecretComponent.toastMessage(),
            })
          }
          activeOpacity={0.7}
        >
          <Text
            type="p2"
            style={[styles.secretText, { color: colors.grey0 }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {secret}
          </Text>
          <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%",
  },
  content: {
    gap: 8,
  },
  secretContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 12,
  },
  secretText: {
    flex: 1,
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
})
