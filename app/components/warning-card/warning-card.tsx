import React from "react"
import { Animated, Easing, Pressable, StyleProp, View, ViewStyle } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type WarningCardProps = {
  // Bold heading rendered above the body, alongside the warning icon.
  title?: string
  numberOfLines?: number
  // When provided the card is tappable: it takes the grey5 active surface and a
  // press animation. Without it the card is static and uses grey7.
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export const WarningCard: React.FC<React.PropsWithChildren<WarningCardProps>> = ({
  title,
  numberOfLines,
  children,
  onPress,
  style,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const content = (
    <View style={styles.content}>
      {title ? (
        <View style={styles.titleBox}>
          <GaloyIcon name="warning" size={16} color={colors.warning} />
          <Text color={colors.warning} style={styles.titleText}>
            {title}
          </Text>
        </View>
      ) : null}
      {children ? (
        <View style={styles.row}>
          {!title && <GaloyIcon name="warning" size={18} color={colors.warning} />}
          <Text
            type="p3"
            style={styles.body}
            numberOfLines={numberOfLines}
            ellipsizeMode="tail"
          >
            {children}
          </Text>
        </View>
      ) : null}
    </View>
  )

  if (!onPress) {
    return <View style={[styles.card, styles.static, style]}>{content}</View>
  }

  const breatheIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start()
  }

  const breatheOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start()
  }

  return (
    <Pressable onPress={onPress} onPressIn={breatheIn} onPressOut={breatheOut}>
      <Animated.View
        style={[styles.card, styles.active, { transform: [{ scale: scaleAnim }] }, style]}
      >
        {content}
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  static: {
    backgroundColor: colors.grey7,
  },
  active: {
    backgroundColor: colors.grey5,
  },
  content: {
    rowGap: 8,
  },
  titleBox: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    columnGap: 8,
    paddingVertical: 3,
  },
  titleText: {
    // flex lets the title wrap instead of overflowing the card. Naming a
    // weighted face ("SourceSansPro-Bold") alongside the theme's fontWeight
    // makes Android synthesise the weight, so glyphs draw wider than they
    // measure and long titles run past the padding. Matches InfoCard, and
    // "Paragraph 2/Bold" in Figma: 16px, 1.375em line height, weight 700.
    flex: 1,
    fontFamily: "Source Sans Pro",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    // Android otherwise pads the text box beyond the line box, pushing the
    // glyphs above the icon and leaving the card taller than its content.
    includeFontPadding: false,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  body: {
    flex: 1,
    includeFontPadding: false,
  },
}))
