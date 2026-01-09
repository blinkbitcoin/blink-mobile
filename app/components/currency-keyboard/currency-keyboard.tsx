import React, { useEffect, useState } from "react"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"
import { Pressable, StyleProp, View, ViewStyle } from "react-native"

import { testProps } from "@app/utils/testProps"

import { Key as KeyType } from "../amount-input-screen/number-pad-reducer"

const KEY_ROW_PREFIX = "row-"
const KEY_TEST_ID_PREFIX = "Key"

const useStyles = makeStyles(({ colors }, compact: boolean) => ({
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: compact ? 15 : 30,
  },
  lastKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  keyText: {
    color: colors.grey2,
    fontSize: 24,
    fontWeight: "bold",
    textAlignVertical: "center",
  },
  pressedOpacity: {
    opacity: 0.7,
  },
}))

type CurrencyKeyboardProps = {
  onPress: (pressed: KeyType) => void
  compact?: boolean
  safeMode?: boolean
}

export const CurrencyKeyboard: React.FC<CurrencyKeyboardProps> = ({
  onPress,
  compact = false,
  safeMode = false,
}) => {
  const styles = useStyles(compact)

  const keyRows = [
    [KeyType[1], KeyType[2], KeyType[3]],
    [KeyType[4], KeyType[5], KeyType[6]],
    [KeyType[7], KeyType[8], KeyType[9]],
  ]

  const lastRow = [KeyType.Decimal, KeyType[0], KeyType.Backspace]

  return (
    <View>
      {keyRows.map((row, rowIndex) => (
        <View key={`${KEY_ROW_PREFIX}${rowIndex}`} style={styles.keyRow}>
          {row.map((key) => (
            <Key
              key={key}
              numberPadKey={key}
              handleKeyPress={onPress}
              compact={compact}
              safeMode={safeMode}
            />
          ))}
        </View>
      ))}
      <View style={styles.lastKeyRow}>
        {lastRow.map((key) => (
          <Key
            key={key}
            numberPadKey={key}
            handleKeyPress={onPress}
            compact={compact}
            safeMode={safeMode}
          />
        ))}
      </View>
    </View>
  )
}

const Key = ({
  handleKeyPress,
  numberPadKey,
  compact,
  safeMode,
}: {
  numberPadKey: KeyType
  handleKeyPress: (key: KeyType) => void
  compact?: boolean
  safeMode?: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles(compact)
  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    const baseStyle: StyleProp<ViewStyle> = {
      height: 40,
      width: 40,
      borderRadius: 40,
      maxWidth: 40,
      maxHeight: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }

    if (pressed) {
      return {
        ...baseStyle,
        backgroundColor: colors.grey4,
      }
    }
    return baseStyle
  }

  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)

  const handleBackSpacePressIn = (numberPadKey: KeyType) => {
    if (safeMode) return
    const id = setInterval(() => {
      if (numberPadKey === KeyType.Backspace) {
        handleKeyPress(numberPadKey)
      }
    }, 300)
    setTimerId(id)
  }

  const handleBackSpacePressOut = () => {
    if (timerId) {
      clearInterval(timerId)
      setTimerId(null)
    }
  }

  useEffect(() => {
    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [timerId])

  return (
    <Pressable
      style={pressableStyle}
      hitSlop={20}
      onPressIn={() => handleBackSpacePressIn(numberPadKey)}
      onPress={() => handleKeyPress(numberPadKey)}
      onPressOut={handleBackSpacePressOut}
      {...testProps(`${KEY_TEST_ID_PREFIX} ${numberPadKey}`)}
    >
      {({ pressed }) => {
        return (
          <Text
            style={pressed ? [styles.keyText, styles.pressedOpacity] : styles.keyText}
          >
            {numberPadKey}
          </Text>
        )
      }}
    </Pressable>
  )
}
