import React, { useCallback, useEffect, useRef } from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { Pressable, View } from "react-native"

import { haptics } from "@app/utils/haptics"
import { testProps } from "@app/utils/testProps"
import { GaloyIcon } from "../atomic/galoy-icon"
import { Key as KeyType } from "../amount-input-screen/number-pad-reducer"
import { fonts } from "@app/rne-theme/fonts"

const KEY_ROW_PREFIX = "row-"
const KEY_TEST_ID_PREFIX = "Key"
const BACKSPACE_REPEAT_MS = 300

type CurrencyKeyboardProps = {
  /** Returns whether the press changed the amount: a refused key stays silent. */
  onPress: (pressed: KeyType) => boolean
  safeMode?: boolean
  disabledKeys?: ReadonlySet<KeyType>
  disabled?: boolean
}

export const CurrencyKeyboard: React.FC<CurrencyKeyboardProps> = ({
  onPress,
  safeMode = false,
  disabledKeys,
  disabled = false,
}) => {
  const styles = useStyles()

  const keyRows = [
    [KeyType[1], KeyType[2], KeyType[3]],
    [KeyType[4], KeyType[5], KeyType[6]],
    [KeyType[7], KeyType[8], KeyType[9]],
    [KeyType.Decimal, KeyType[0], KeyType.Backspace],
  ]

  return (
    <View style={styles.keyboard}>
      {keyRows.map((row, rowIndex) => (
        <View key={`${KEY_ROW_PREFIX}${rowIndex}`} style={styles.keyRow}>
          {row.map((key) => {
            const isKeyDisabled = disabled || (disabledKeys?.has(key) ?? false)
            return (
              <Key
                key={key}
                numberPadKey={key}
                handleKeyPress={onPress}
                safeMode={safeMode}
                disabled={isKeyDisabled}
              />
            )
          })}
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
  handleKeyPress: (key: KeyType) => boolean
  safeMode?: boolean
  disabled?: boolean
}) => {
  const styles = useStyles()
  const isBackspace = numberPadKey === KeyType.Backspace

  /** Latest handler, not the one from the render the hold began in: a pad's handler closes
   *  over its current amount, so a stale one would re-apply the same deletion every tick. */
  const handleKeyPressRef = useRef(handleKeyPress)
  handleKeyPressRef.current = handleKeyPress
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  /** One haptic per gesture: a held backspace deletes repeatedly but buzzes once. */
  const hasTapped = useRef(false)

  const stopRepeat = useCallback(() => {
    if (!repeatTimer.current) return
    clearInterval(repeatTimer.current)
    repeatTimer.current = null
  }, [])

  const press = (key: KeyType) => {
    const accepted = handleKeyPressRef.current(key)
    if (accepted && !hasTapped.current) {
      hasTapped.current = true
      haptics.tap()
    }
    return accepted
  }

  const handlePressIn = (key: KeyType) => {
    hasTapped.current = false
    if (safeMode) return
    if (key !== KeyType.Backspace) return
    stopRepeat()
    /** A refused tick means the amount is empty: stop rather than tick against nothing. */
    repeatTimer.current = setInterval(() => {
      if (!press(key)) stopRepeat()
    }, BACKSPACE_REPEAT_MS)
  }

  /** A key disabled mid-hold may never see its press-out. */
  useEffect(() => {
    if (disabled) stopRepeat()
  }, [disabled, stopRepeat])

  useEffect(() => stopRepeat, [stopRepeat])

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.key,
        disabled && styles.keyDisabled,
        pressed && styles.keyPressedBg,
      ]}
      onPressIn={() => handlePressIn(numberPadKey)}
      onPress={() => press(numberPadKey)}
      onPressOut={stopRepeat}
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
    gap: 5,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    paddingVertical: 0,
  },
  keyRow: {
    flexDirection: "row",
    gap: 5,
  },
  key: {
    flex: 1,
    minHeight: 45,
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
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    textAlign: "center",
  },
  backspaceIcon: {
    color: colors.primary,
  },
}))
