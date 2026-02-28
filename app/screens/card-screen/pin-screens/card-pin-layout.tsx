import React, { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { StepsProgressBar } from "@app/components/steps-progress-bar"
import { NumericKeypad, NumericKey } from "@app/components/numeric-keypad"

const PIN_LENGTH = 4

type CardPinLayoutProps = {
  steps: string[]
  currentStep: number
  title: string
  subtitle: string
  errorMessage?: string
  showConfirmButton?: boolean
  confirmButtonLabel?: string
  resetTrigger?: number
  onPinComplete: (pin: string) => void
  onPinChange?: () => void
  onConfirm?: () => void
}

export const CardPinLayout: React.FC<CardPinLayoutProps> = ({
  steps,
  currentStep,
  title,
  subtitle,
  errorMessage,
  showConfirmButton,
  confirmButtonLabel,
  resetTrigger,
  onPinComplete,
  onPinChange,
  onConfirm,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [pin, setPin] = useState("")

  useEffect(() => {
    setPin("")
  }, [resetTrigger])

  const handleKeyPress = useCallback(
    (key: NumericKey) => {
      if (key === NumericKey.Backspace) {
        setPin((prev) => {
          const newPin = prev.slice(0, -1)
          onPinChange?.()
          return newPin
        })
        return
      }

      if (key === NumericKey.Decimal || pin.length >= PIN_LENGTH) return

      const newPin = pin + key
      setPin(newPin)
      onPinChange?.()

      if (newPin.length === PIN_LENGTH) onPinComplete(newPin)
    },
    [pin, onPinComplete, onPinChange],
  )

  const renderPinDisplay = () => {
    const displayValue = pin.length > 0 ? pin : " "
    const containerStyle = errorMessage
      ? [styles.pinContainer, styles.pinContainerError]
      : styles.pinContainer

    return (
      <View style={styles.pinDisplayWrapper}>
        <View style={containerStyle}>
          <Text style={styles.pinText}>{displayValue}</Text>
        </View>
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      </View>
    )
  }

  return (
    <Screen preset="fixed" style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.progressBarContainer}>
          <StepsProgressBar steps={steps} currentStep={currentStep} />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <GaloyIcon
              name="key-outline"
              size={28}
              color={colors.primary}
              backgroundColor={colors.grey5}
              containerSize={52}
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {renderPinDisplay()}
        </View>
      </View>

      {showConfirmButton && confirmButtonLabel && onConfirm && (
        <View style={styles.buttonWrapper}>
          <GaloyPrimaryButton title={confirmButtonLabel} onPress={onConfirm} />
        </View>
      )}

      <View style={styles.keypadContainer}>
        <NumericKeypad onKeyPress={handleKeyPress} disabledKeys={[NumericKey.Decimal]} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressBarContainer: {
    marginTop: 16,
    alignSelf: "center",
  },
  mainContent: {
    alignItems: "center",
    marginTop: 20,
    gap: 20,
  },
  iconContainer: {
    marginTop: 12,
  },
  textContainer: {
    alignItems: "center",
    gap: 0,
  },
  title: {
    fontFamily: "Source Sans Pro",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Source Sans Pro",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    color: colors.grey2,
    textAlign: "center",
  },
  pinDisplayWrapper: {
    alignItems: "center",
    gap: 8,
  },
  pinContainer: {
    width: 100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  pinContainerError: {
    borderColor: colors.error,
  },
  pinText: {
    fontFamily: "Source Sans Pro",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    color: colors.black,
    textAlign: "center",
  },
  errorText: {
    fontFamily: "Source Sans Pro",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    color: colors.error,
    textAlign: "center",
  },
  buttonWrapper: {
    paddingTop: 10,
    paddingBottom: 7,
    paddingHorizontal: 24,
  },
  keypadContainer: {
    paddingVertical: 14,
  },
}))
