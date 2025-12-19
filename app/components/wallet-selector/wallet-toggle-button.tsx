import React from "react"
import { ActivityIndicator, TouchableHighlight, ViewStyle, StyleProp } from "react-native"
import { useTheme, makeStyles } from "@rn-vui/themed"
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
    <TouchableHighlight
      style={[styles.button, containerStyle, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
      underlayColor={colors.grey6}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Icon name="arrow-down-outline" color={colors.primary} size={25} />
      )}
    </TouchableHighlight>
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
    backgroundColor: colors.grey6,
  },
}))
