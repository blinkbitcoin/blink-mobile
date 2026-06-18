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
  action: () => Promise<void>
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

  return (
    <TouchableOpacity style={styles.buttonContainer} onPress={action}>
      <View style={styles.contentSection}>
        <View style={styles.contentRow}>
          {icon && (
            <View style={styles.leftIconContainer}>
              <GaloyIcon name={icon} color={colors.primary} size={24} />
            </View>
          )}
          <View style={styles.textColumn}>
            <Text style={styles.titleStyle}>{title}</Text>
            <Text style={styles.bodyText}>{text}</Text>
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
      {buttonLabel && (
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
    alignItems: "flex-start",
    justifyContent: "center",
  },
  titleStyle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
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
