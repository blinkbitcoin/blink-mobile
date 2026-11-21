import React, { Ref, useCallback, useEffect, useRef } from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { Pressable, View } from "react-native"

import { radius } from "@app/rne-theme/radius"
import { haptics } from "@app/utils/haptics"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { fonts } from "@app/rne-theme/fonts"
import { GaloyIcon } from "../atomic/galoy-icon"
import { Key as KeyType } from "../amount-input-screen/number-pad-reducer"

const KEY_ROW_PREFIX = "row-"
const KEY_TEST_ID_PREFIX = "Key"
const BACKSPACE_REPEAT_MS = 300

type CurrencyKeyboardProps = {
  /** Returns whether the press changed the amount: a refused key stays silent. */
  onPress: (pressed: KeyType) => boolean
  disabledKeys?: ReadonlySet<KeyType>
  disabled?: boolean
  /** The first key, "1": where screen reader focus lands to start typing an amount. */
  firstKeyRef?: Ref<View>
}

export const CurrencyKeyboard: React.FC<CurrencyKeyboardProps> = ({
  onPress,
  disabledKeys,
  disabled = false,
  firstKeyRef,
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
                disabled={isKeyDisabled}
                pressableRef={key === KeyType[1] ? firstKeyRef : undefined}
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
  disabled,
  pressableRef,
}: {
  numberPadKey: KeyType
  handleKeyPress: (key: KeyType) => boolean
  disabled?: boolean
  pressableRef?: Ref<View>
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const isBackspace = numberPadKey === KeyType.Backspace

  /** Latest handler, not the one from the render the hold began in: a pad's handler closes
   *  over its current amount, so a stale one would re-apply the same deletion every tick. */
  const handleKeyPressRef = useRef(handleKeyPress)
  handleKeyPressRef.current = handleKeyPress
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  /** One haptic per pointer gesture: a held backspace deletes repeatedly but buzzes once.
   *  Armed only by pressIn. An accessibility click calls onPress and never pressIn, so it
   *  must not leave the guard set. */
  const hasTapped = useRef(false)
  const pointerDown = useRef(false)
  /** A repeat tick already deleted. Release still emits onPress; that press must not delete again. */
  const repeatFired = useRef(false)
  /** Cleared if the release onPress follows pressOut. If it never comes, the timeout drops the guard. */
  const releaseGuard = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearReleaseGuard = useCallback(() => {
    if (!releaseGuard.current) return
    clearTimeout(releaseGuard.current)
    releaseGuard.current = null
  }, [])

  const stopRepeat = useCallback(() => {
    if (!repeatTimer.current) return
    clearInterval(repeatTimer.current)
    repeatTimer.current = null
  }, [])

  const press = (key: KeyType) => {
    const accepted = handleKeyPressRef.current(key)
    if (accepted && !(pointerDown.current && hasTapped.current)) {
      hasTapped.current = pointerDown.current
      haptics.tap()
    }
    return accepted
  }

  const endPointerGesture = () => {
    pointerDown.current = false
    hasTapped.current = false
  }

  const handlePressIn = (key: KeyType) => {
    pointerDown.current = true
    hasTapped.current = false
    repeatFired.current = false
    clearReleaseGuard()
    if (key !== KeyType.Backspace) return
    stopRepeat()
    /** A refused tick means the amount is empty: stop rather than tick against nothing. */
    repeatTimer.current = setInterval(() => {
      repeatFired.current = true
      if (!press(key)) stopRepeat()
    }, BACKSPACE_REPEAT_MS)
  }

  const handlePressOut = () => {
    stopRepeat()
    if (!repeatFired.current) return
    clearReleaseGuard()
    releaseGuard.current = setTimeout(() => {
      repeatFired.current = false
      pointerDown.current = false
      hasTapped.current = false
      releaseGuard.current = null
    }, 0)
  }

  const handlePress = () => {
    clearReleaseGuard()
    if (!repeatFired.current) press(numberPadKey)
    repeatFired.current = false
    endPointerGesture()
  }

  /** A key disabled mid-hold may never see its press-out. */
  useEffect(() => {
    if (disabled) stopRepeat()
  }, [disabled, stopRepeat])

  useEffect(
    () => () => {
      stopRepeat()
      clearReleaseGuard()
    },
    [stopRepeat, clearReleaseGuard],
  )

  return (
    <Pressable
      ref={pressableRef}
      disabled={disabled}
      style={({ pressed }) => [
        styles.key,
        disabled && styles.keyDisabled,
        pressed && styles.keyPressedBg,
      ]}
      onPressIn={() => handlePressIn(numberPadKey)}
      onPress={handlePress}
      onPressOut={handlePressOut}
      {...testProps(`${KEY_TEST_ID_PREFIX} ${numberPadKey}`)}
      accessibilityRole="button"
      accessibilityLabel={isBackspace ? LL.Accessibility.deleteKey() : numberPadKey}
      accessibilityState={{ disabled }}
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
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPressedBg: {
    backgroundColor: colors.surfaceInteractive,
  },
  keyText: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    textAlign: "center",
  },
  backspaceIcon: {
    color: colors.accent,
  },
}))
