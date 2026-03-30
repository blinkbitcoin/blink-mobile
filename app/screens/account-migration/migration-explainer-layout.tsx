import React from "react"
import { ScrollView, Text, View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"

type MigrationExplainerLayoutProps = {
  icon: IconNamesType
  iconColor: string
  title: string
  steps: ReadonlyArray<React.ReactNode>
  ctaTitle: string
  onCtaPress: () => void
}

export const MigrationExplainerLayout: React.FC<MigrationExplainerLayoutProps> = ({
  icon,
  iconColor,
  title,
  steps,
  ctaTitle,
  onCtaPress,
}) => {
  const styles = useStyles()

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <IconHero icon={icon} iconColor={iconColor} title={title} />

        <View style={styles.stepsContainer}>
          {steps.map((content, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={[styles.stepBase, styles.stepNumber]}>{`${index + 1}.`}</Text>
              <Text style={[styles.stepBase, styles.stepText]}>{content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={ctaTitle} onPress={onCtaPress} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollContent: {
    paddingHorizontal: 20,
  },
  stepsContainer: {
    gap: 4,
    paddingTop: 14,
  },
  stepRow: {
    flexDirection: "row",
  },
  stepBase: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.black,
  },
  stepNumber: {
    width: 20,
  },
  stepText: {
    flex: 1,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
