import * as React from "react"
import { View } from "react-native"
import { Text, makeStyles, useTheme } from "@rneui/themed"

import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export type OnboardingLayoutProps = {
  title: string
  descriptions?: string[]
  customContent?: React.ReactNode
  iconName?: IconNamesType
  primaryLabel: string
  secondaryLabel?: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  title,
  descriptions,
  customContent,
  iconName,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.descriptionList}>
          {descriptions?.map((line, index) => (
            <View key={index} style={styles.descriptionItem}>
              <Text style={styles.descriptionText}>- {line}</Text>
            </View>
          ))}
          {customContent && <View>{customContent}</View>}
        </View>

        {iconName && (
          <View style={styles.iconWrapper}>
            <GaloyIcon name={iconName} color={colors.primary3} size={110} />
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        <GaloyPrimaryButton
          title={primaryLabel}
          onPress={onPrimaryAction}
          containerStyle={styles.buttonContainer}
        />
        {secondaryLabel && onSecondaryAction && (
          <GaloySecondaryButton title={secondaryLabel} onPress={onSecondaryAction} />
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  title: {
    paddingHorizontal: 5,
    marginBottom: 10,
    fontSize: 18,
  },
  descriptionList: {
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  descriptionItem: {
    marginBottom: 4,
  },
  descriptionText: {
    color: colors.grey2,
    fontSize: 16,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 36,
    paddingHorizontal: 24,
  },
  buttonContainer: {
    marginVertical: 6,
  },
  iconWrapper: {
    alignItems: "center",
    marginTop: 40,
    position: "relative",
  },
}))
