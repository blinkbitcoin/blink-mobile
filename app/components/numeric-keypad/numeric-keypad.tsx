import React, { useCallback } from "react"
import { Pressable, View, StyleProp, ViewStyle } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

export const NumericKey = {
  0: "0",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  Decimal: ".",
  Backspace: "⌫",
} as const

export type NumericKey = (typeof NumericKey)[keyof typeof NumericKey]

type NumericKeypadProps = {
  onKeyPress: (key: NumericKey) => void
  disabled?: boolean
  disabledKeys?: NumericKey[]
}

const KEY_TEST_ID_PREFIX = "NumericKey"

const KEY_ROWS: NumericKey[][] = [
  [NumericKey[1], NumericKey[2], NumericKey[3], NumericKey.Backspace],
  [NumericKey[4], NumericKey[5], NumericKey[6], NumericKey.Decimal],
  [NumericKey[7], NumericKey[8], NumericKey[9], NumericKey[0]],
]

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onKeyPress,
  disabled,
  disabledKeys = [],
}) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      {KEY_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keyRow}>
          {row.map((keyValue) => (
            <KeypadKey
              key={keyValue}
              keyValue={keyValue}
              onPress={onKeyPress}
              disabled={disabled || disabledKeys.includes(keyValue)}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

type KeypadKeyProps = {
  keyValue: NumericKey
  onPress: (key: NumericKey) => void
  disabled?: boolean
}

const KeypadKey: React.FC<KeypadKeyProps> = ({ keyValue, onPress, disabled }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const handlePress = useCallback(() => {
    onPress(keyValue)
  }, [keyValue, onPress])

  const getPressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
      if (disabled) return [styles.key, styles.keyDisabled]
      if (pressed) return [styles.key, styles.keyPressed]
      return styles.key
    },
    [disabled, styles.key, styles.keyDisabled, styles.keyPressed],
  )

  const isBackspace = keyValue === NumericKey.Backspace
  const iconColor = disabled ? colors.grey3 : colors.primary
  const textStyle = disabled ? [styles.keyText, styles.keyTextDisabled] : styles.keyText

  return (
    <Pressable
      style={getPressableStyle}
      onPress={handlePress}
      disabled={disabled}
      {...testProps(`${KEY_TEST_ID_PREFIX}-${keyValue}`)}
    >
      {isBackspace ? (
        <GaloyIcon name="back-space" size={28} color={iconColor} />
      ) : (
        <Text style={textStyle}>{keyValue}</Text>
      )}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  key: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  keyPressed: {
    backgroundColor: colors.grey4,
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyText: {
    fontFamily: "Source Sans Pro",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    color: colors.black,
    textAlign: "center",
  },
  keyTextDisabled: {
    color: colors.grey3,
  },
}))
