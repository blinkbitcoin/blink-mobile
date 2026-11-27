import React from "react"
import { ActivityIndicator, StyleProp, TouchableHighlight, ViewStyle } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
export type WalletToggleButtonProps = {
  loading: boolean
  disabled: boolean
  /** Shows the one direction the money moves in, as during a top-up of the card,
   *  instead of the flip. */
  isDirectionFixed?: boolean
  onPress: () => void
  containerStyle?: StyleProp<ViewStyle>
  testID?: string
}

export const WalletToggleButton: React.FC<WalletToggleButtonProps> = ({
  loading,
  disabled,
  isDirectionFixed = false,
  onPress,
  containerStyle,
  testID,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  /** A fixed direction is not a flip turned off, so it keeps the button's own grey. */
  const isDimmed = disabled && !isDirectionFixed

  return (
    <TouchableHighlight
      style={[styles.button, containerStyle, isDimmed && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
      underlayColor={colors.surfacePressed}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <GaloyIcon
          name={isDirectionFixed ? "arrow-down" : "transfer"}
          color={isDirectionFixed ? colors.textDisabled : colors.accent}
          size={25}
        />
      )}
    </TouchableHighlight>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    height: 50,
    width: 50,
    borderRadius: 50,
    backgroundColor: colors.neutral,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: colors.surfacePressed,
  },
}))
