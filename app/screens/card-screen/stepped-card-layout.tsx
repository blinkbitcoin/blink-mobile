import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { StepsProgressBar } from "@app/components/steps-progress-bar"

type SteppedCardLayoutProps = {
  steps: string[]
  currentStep: number
  icon: IconNamesType
  iconColor?: string
  title?: string
  subtitle: string
  buttonLabel: string
  onButtonPress: () => void
  isButtonDisabled?: boolean
  children: React.ReactNode
}

export const SteppedCardLayout: React.FC<SteppedCardLayoutProps> = ({
  steps,
  currentStep,
  icon,
  iconColor,
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
  isButtonDisabled = false,
  children,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const resolvedIconColor = iconColor ?? colors.primary

  return (
    <Screen preset="scroll">
      <View style={styles.container}>
        <View style={styles.progressBarContainer}>
          <StepsProgressBar steps={steps} currentStep={currentStep} />
        </View>

        <View style={styles.headerSection}>
          <GaloyIcon
            name={icon}
            size={34}
            color={resolvedIconColor}
            backgroundColor={colors.grey5}
            containerSize={44}
          />

          <View style={styles.textContainer}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.content}>{children}</View>

        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            title={buttonLabel}
            onPress={onButtonPress}
            disabled={isButtonDisabled}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  progressBarContainer: {
    alignSelf: "center",
    width: "100%",
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 14,
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
    maxWidth: 264,
  },
  title: {
    fontFamily: "Source Sans Pro",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
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
  content: {
    gap: 20,
  },
  buttonContainer: {
    marginTop: 10,
  },
}))
