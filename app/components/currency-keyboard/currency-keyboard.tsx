import React, { useEffect, useState } from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { Pressable, View } from "react-native"

import { testProps } from "@app/utils/testProps"
import { GaloyIcon } from "../atomic/galoy-icon"
import { Key as KeyType } from "../amount-input-screen/number-pad-reducer"

const KEY_ROW_PREFIX = "row-"
const KEY_TEST_ID_PREFIX = "Key"

type CurrencyKeyboardProps = {
  onPress: (pressed: KeyType) => void
  safeMode?: boolean
  disabledKeys?: ReadonlySet<KeyType>
}

export const CurrencyKeyboard: React.FC<CurrencyKeyboardProps> = ({
  onPress,
  safeMode = false,
  disabledKeys,
}) => {
  const styles = useStyles()

  const keyRows = [
    [KeyType[1], KeyType[2], KeyType[3], KeyType.Backspace],
    [KeyType[4], KeyType[5], KeyType[6], KeyType.Decimal],
    [KeyType[7], KeyType[8], KeyType[9], KeyType[0]],
  ]

  return (
    <View style={styles.keyboard}>
      {keyRows.map((row, rowIndex) => (
        <View key={`${KEY_ROW_PREFIX}${rowIndex}`} style={styles.keyRow}>
          {row.map((key) => (
            <Key
              key={key}
              numberPadKey={key}
              handleKeyPress={onPress}
              safeMode={safeMode}
              disabled={disabledKeys?.has(key) ?? false}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

const Key = ({
  handleKeyPress,
  numberPadKey,
  safeMode,
  disabled,
}: {
  numberPadKey: KeyType
  handleKeyPress: (key: KeyType) => void
  safeMode?: boolean
  disabled?: boolean
}) => {
  const styles = useStyles()
  const isBackspace = numberPadKey === KeyType.Backspace

  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)

  const handleBackSpacePressIn = (key: KeyType) => {
    if (safeMode) return
    if (key !== KeyType.Backspace) return
    const id = setInterval(() => {
      handleKeyPress(key)
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
      disabled={disabled}
      style={({ pressed }) => [
        styles.key,
        disabled && styles.keyDisabled,
        pressed && styles.keyPressedBg,
      ]}
      onPressIn={() => handleBackSpacePressIn(numberPadKey)}
      onPress={() => handleKeyPress(numberPadKey)}
      onPressOut={handleBackSpacePressOut}
      {...testProps(`${KEY_TEST_ID_PREFIX} ${numberPadKey}`)}
    >
      {isBackspace ? (
        <GaloyIcon name="back-space" size={28} color={styles.backspaceIcon.color} />
      ) : (
        <Text style={styles.keyText}>{numberPadKey}</Text>
      )}
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  keyboard: {
    gap: 8,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  keyRow: {
    flexDirection: "row",
    gap: 8,
  },
  key: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey4,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPressedBg: {
    backgroundColor: colors.grey5,
  },
  keyText: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
    textAlign: "center",
  },
  backspaceIcon: {
    color: colors.primary,
  },
}))
