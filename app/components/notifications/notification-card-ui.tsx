import React from "react"
import { ActivityIndicator, Pressable, TouchableOpacity, View } from "react-native"

import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"

import { BulletinCarouselItemContext } from "./bulletin-carousel-context"

/** The body and its "Read more" line together take at most this many lines. */
const MAX_BODY_LINES = 4

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
  const { LL } = useI18nContext()
  const { isActive } = React.useContext(BulletinCarouselItemContext)

  /** Lines the full body takes at the rendered width and font scale, measured on a
   *  hidden copy so the clamp holds with Dynamic Type and Android font scaling. */
  const [bodyLineCount, setBodyLineCount] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)
  const isTruncated = bodyLineCount > MAX_BODY_LINES && !expanded

  /** Swiping away folds the card back; it is not remembered across swipes. */
  React.useEffect(() => {
    if (!isActive) setExpanded(false)
  }, [isActive])

  const expand = () => setExpanded(true)

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
            <View>
              <Text
                type="p3"
                style={[styles.bodyText, styles.measure]}
                onTextLayout={(event) => setBodyLineCount(event.nativeEvent.lines.length)}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                {text}
              </Text>
              <Text
                type="p3"
                style={styles.bodyText}
                numberOfLines={isTruncated ? MAX_BODY_LINES - 1 : undefined}
                ellipsizeMode="tail"
                accessibilityLabel={text}
              >
                {text}
              </Text>
              {isTruncated && (
                <Text
                  type="p3"
                  style={[styles.bodyText, styles.readMore]}
                  onPress={expand}
                  accessibilityRole="button"
                >
                  {LL.HomeScreen.bulletinReadMore()}
                </Text>
              )}
            </View>
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

  /** While the body is cut short, a tap anywhere on the card reads more instead of
   *  opening the link: only the button opens it. Not a button for screen readers,
   *  which read the full body and reach "Read more" on its own. */
  if (isTruncated) {
    return (
      <Pressable style={styles.buttonContainer} onPress={expand} accessible={false}>
        {content}
      </Pressable>
    )
  }

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
  measure: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0,
  },
  readMore: {
    textDecorationLine: "underline",
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
