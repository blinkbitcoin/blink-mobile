import * as React from "react"
import { View } from "react-native"
import { Text, makeStyles } from "@rneui/themed"

import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export type OnboardingInfoTemplateScreenProps = {
  title: string
  descriptions: string[]
  iconName?: IconNamesType
  primaryLabel: string
  onPrimaryAction: () => void
  secondaryLabel?: string
  onSecondaryAction?: () => void
}

export const OnboardingInfoTemplateScreen: React.FC<
  OnboardingInfoTemplateScreenProps
> = ({
  title,
  descriptions,
  iconName,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
}) => {
  const styles = useStyles()

  return (
    <Screen>
      {iconName && <GaloyIcon name={iconName} style={styles.icon} size={100} />}

      <View style={styles.content}>
        <Text type="h1" style={styles.title}>
          {title}
        </Text>

        <View style={styles.descriptionList}>
          {descriptions.map((line, index) => (
            <View key={index} style={styles.descriptionItem}>
              <Text type="h2" style={styles.descriptionText}>
                - {line}
              </Text>
            </View>
          ))}
        </View>
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
  },
  title: {
    paddingHorizontal: 5,
    marginBottom: 10,
    fontSize: 18,
  },
  icon: {
    alignSelf: "center",
    marginVertical: 40,
    color: colors.primary3,
  },
  descriptionList: {
    paddingHorizontal: 5,
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
}))
