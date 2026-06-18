import React from "react"
import { Pressable } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"

type AddToWalletButtonProps = {
  onPress: () => void
  disabled?: boolean
}

export const AddToWalletButton: React.FC<AddToWalletButtonProps> = ({
  onPress,
  disabled = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={isIos ? "Add to Apple Wallet" : "Add to Google Pay"}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{LL.CardFlow.AddToMobileWallet.addTo()}</Text>
      <GaloyIcon
        name={isIos ? "apple-pay" : "google-pay"}
        width={isIos ? 55 : 62}
        height={isIos ? 22 : 24}
        color={colors._darkGrey}
      />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 8,
    height: 50,
    backgroundColor: colors._white,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors._darkGrey,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: colors._darkGrey,
    fontSize: 20,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 24,
  },
}))
