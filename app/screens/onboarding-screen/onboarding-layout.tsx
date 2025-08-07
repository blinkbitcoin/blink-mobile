import * as React from "react"
import { View } from "react-native"
import { Text, makeStyles, useTheme } from "@rneui/themed"

import { Screen } from "@app/components/screen"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

export type OnboardingLayoutProps = {
  title?: string
  descriptions?: string[]
  customContent?: React.ReactNode
  iconName?: IconNamesType
  primaryLabel: string
  secondaryLabel?: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
  primaryLoading?: boolean
  secondaryLoading?: boolean
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
  primaryLoading = false,
  secondaryLoading = false,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <Screen style={styles.screenStyle}>
      <View style={styles.content}>
        {title && (
          <Text type="h2" style={styles.title}>
            {title}
          </Text>
        )}

        <View style={styles.descriptionList}>
          {descriptions?.map((line, index) => (
            <View key={index} style={styles.descriptionItem}>
              <Text type="h2" style={styles.descriptionText}>
                - {line}
              </Text>
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
          loading={primaryLoading}
        />
        {secondaryLabel && onSecondaryAction && (
          <GaloySecondaryButton
            title={secondaryLabel}
            onPress={onSecondaryAction}
            loading={secondaryLoading}
            containerStyle={styles.secondaryButtonContainer}
          />
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  secondaryButtonContainer: {
    marginTop: 15,
    marginBottom: -15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 36,
  },
  title: {
    paddingHorizontal: 5,
    marginBottom: 10,
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
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  iconWrapper: {
    alignItems: "center",
    marginTop: 40,
  },
}))
