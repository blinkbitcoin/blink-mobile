import * as React from "react"
import { View, FlatList } from "react-native"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
  const insets = useSafeAreaInsets()
  const styles = useStyles(insets)
  const hasDescriptions = Boolean(descriptions?.length)

  return (
    <Screen style={styles.screenStyle}>
      <View style={styles.content}>
        <View>
          {title && (
            <Text type="h2" style={styles.title}>
              {title}
            </Text>
          )}

          <View style={styles.descriptionList}>
            {hasDescriptions && (
              <FlatList
                accessibilityRole="list"
                data={descriptions!}
                keyExtractor={(_, i) => String(i)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View
                    accessible
                    accessibilityLabel={`• ${item}`}
                    style={styles.descriptionItem}
                  >
                    <Text type="h2" style={styles.descriptionBullet}>
                      •
                    </Text>
                    <Text type="h2" style={styles.descriptionText}>
                      {item}
                    </Text>
                  </View>
                )}
              />
            )}

            {customContent && (
              <View style={hasDescriptions && styles.customContent}>{customContent}</View>
            )}
          </View>
        </View>

        {iconName && (
          <View style={styles.iconWrapper}>
            <GaloyIcon name={iconName} color={colors.primary} size={110} />
          </View>
        )}

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
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  secondaryButtonContainer: {
    marginTop: 15,
    marginBottom: -15,
  },
  title: {
    paddingHorizontal: 5,
    marginBottom: 16,
  },
  descriptionList: {
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  descriptionItem: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  descriptionBullet: {
    color: colors.grey2,
    marginRight: 8,
    lineHeight: 22,
  },
  descriptionText: {
    color: colors.grey2,
    flex: 1,
    flexWrap: "wrap",
    lineHeight: 22,
  },
  customContent: {
    marginTop: 10,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
  iconWrapper: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}))
