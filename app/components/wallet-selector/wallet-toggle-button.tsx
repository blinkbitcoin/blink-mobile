import React from "react"
import { ActivityIndicator, StyleProp, TouchableHighlight, ViewStyle } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
export type WalletToggleButtonProps = {
  loading: boolean
  disabled: boolean
  onPress: () => void
  containerStyle?: StyleProp<ViewStyle>
  testID?: string
}

export const WalletToggleButton: React.FC<WalletToggleButtonProps> = ({
  loading,
  disabled,
  onPress,
  containerStyle,
  testID,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <TouchableHighlight
      style={[styles.button, containerStyle, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
      underlayColor={colors.surfacePressed}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <GaloyIcon name="transfer" color={colors.accent} size={25} />
      )}
    </TouchableHighlight>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    height: 50,
    width: 50,
    borderRadius: 50,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: colors.surfacePressed,
  },
}))
