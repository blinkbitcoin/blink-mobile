import React from "react"
import { ScrollView, View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { IconHero } from "@app/components/icon-hero"
import { NumberedStepsList } from "@app/components/numbered-steps-list"
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
        <NumberedStepsList steps={steps} />
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={ctaTitle} onPress={onCtaPress} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  scrollContent: {
    paddingHorizontal: 20,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
