import React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"

export type NotificationCardUIProps = {
  title: string
  text: string
  icon?: IconNamesType
  /** Omitting the action renders an inert card: no press feedback, no button role. */
  action?: () => Promise<void>
  loading?: boolean
  dismissAction?: () => void
  buttonLabel?: string
}

export const NotificationCardUI: React.FC<NotificationCardUIProps> = ({
  title,
  text,
  icon,
  action,
  loading,
  dismissAction,
  buttonLabel,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  if (loading) {
    return (
      <TouchableOpacity style={styles.loadingButtonContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </TouchableOpacity>
    )
  }

  const content = (
    <>
      <View style={styles.contentSection}>
        <View style={styles.contentRow}>
          {icon && (
            <View style={styles.leftIconContainer}>
              <GaloyIcon name={icon} color={colors.primary} size={24} />
            </View>
          )}
          <View style={styles.textColumn}>
            <Text type="p3" bold>
              {title}
            </Text>
            <Text type="p3" style={styles.bodyText}>
              {text}
            </Text>
          </View>
          {dismissAction && (
            <GaloyIconButton
              name="close"
              size={"small"}
              iconOnly={true}
              onPress={dismissAction}
            />
          )}
        </View>
      </View>
      {action && buttonLabel && (
        <View style={[styles.buttonActionContainer, icon && styles.buttonWithIcon]}>
          <GaloyPrimaryButton
            title={buttonLabel}
            onPress={action}
            containerStyle={styles.bulletinButtonContainer}
            buttonStyle={styles.bulletinButtonStyle}
            titleStyle={styles.bulletinButtonTitle}
          />
        </View>
      )}
    </>
  )

  /** No action means a text-only card: a plain View, so it never gives press feedback
   *  or announces as a button to screen readers. */
  if (!action) {
    return <View style={styles.buttonContainer}>{content}</View>
  }

  return (
    <TouchableOpacity style={styles.buttonContainer} onPress={action}>
      {content}
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  buttonContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    flexDirection: "column",
  },
  contentSection: {
    paddingVertical: 14,
    flexDirection: "column",
    alignItems: "flex-start",
    alignSelf: "stretch",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 14,
    paddingRight: 10,
    gap: 14,
  },
  textColumn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
  },
  leftIconContainer: {
    justifyContent: "flex-start",
    flexDirection: "row",
  },
  loadingButtonContainer: {
    flexDirection: "column",
    padding: 14,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  bodyText: {
    color: colors.grey2,
  },
  buttonActionContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  buttonWithIcon: {
    paddingLeft: 52,
  },
  bulletinButtonContainer: {
    alignSelf: "flex-start",
  },
  bulletinButtonStyle: {
    minHeight: 36,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bulletinButtonTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.white,
  },
}))
