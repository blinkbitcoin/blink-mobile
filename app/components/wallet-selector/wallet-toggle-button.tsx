import React from "react"
import { ActivityIndicator, TouchableOpacity, ViewStyle, StyleProp } from "react-native"
import { useTheme, makeStyles } from "@rneui/themed"

import Icon from "react-native-vector-icons/Ionicons"

export type WalletToggleButtonProps = {
  loading: boolean
  disabled: boolean
  onPress: () => void
  containerStyle?: StyleProp<ViewStyle>
}

export const WalletToggleButton: React.FC<WalletToggleButtonProps> = ({
  loading,
  disabled,
  onPress,
  containerStyle,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <TouchableOpacity
      style={[styles.button, containerStyle, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Icon name="arrow-down-outline" color={colors.primary} size={25} />
      )}
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    height: 50,
    width: 50,
    borderRadius: 50,
    backgroundColor: colors.grey4,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}))
