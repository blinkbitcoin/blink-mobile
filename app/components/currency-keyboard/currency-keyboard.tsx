import React, { useEffect, useState } from "react"
import { Pressable, StyleProp, View, ViewStyle } from "react-native"

import { testProps } from "@app/utils/testProps"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import { Key as KeyType } from "../amount-input-screen/number-pad-reducer"

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
  pressedKeyText: {
    color: colors.grey2,
    fontSize: 24,
    fontWeight: "bold",
    textAlignVertical: "center",
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
  return (
    <View>
      <View style={styles.keyRow}>
        <Key
          numberPadKey={KeyType[1]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[2]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[3]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
      </View>
      <View style={styles.keyRow}>
        <Key
          numberPadKey={KeyType[4]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[5]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[6]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
      </View>
      <View style={styles.keyRow}>
        <Key
          numberPadKey={KeyType[7]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[8]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[9]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
      </View>
      <View style={styles.lastKeyRow}>
        <Key
          numberPadKey={KeyType.Decimal}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType[0]}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
        <Key
          numberPadKey={KeyType.Backspace}
          handleKeyPress={onPress}
          compact={compact}
          safeMode={safeMode}
        />
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
      {...testProps(`Key ${numberPadKey}`)}
    >
      {({ pressed }) => {
        return (
          <Text style={pressed ? styles.pressedKeyText : styles.keyText}>
            {numberPadKey}
          </Text>
        )
      }}
    </Pressable>
  )
}
