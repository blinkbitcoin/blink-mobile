import React from "react"
import { Animated, Easing, Pressable, StyleProp, View, ViewStyle } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

export type CardType = "default" | "warning"

type CardProps = {
  // "warning" adds a 1px solid warning border and a warning icon.
  type?: CardType
  // Bold heading rendered above the body.
  title?: string
  numberOfLines?: number
  // When provided the card is clickable: it uses the grey5 surface and a
  // press animation. Without it the card is static and uses grey7.
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export const Card: React.FC<React.PropsWithChildren<CardProps>> = ({
  type = "default",
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

  const isWarning = type === "warning"

  const content = (
    <View style={styles.content}>
      {title ? (
        <View style={styles.titleBox}>
          <GaloyIcon name="warning" size={16} color={colors.warning} />
          <Text type="p2" bold color={colors.warning} style={styles.titleText}>
            {title}
          </Text>
        </View>
      ) : null}
      {children ? (
        <View style={styles.row}>
          {isWarning && !title && (
            <GaloyIcon name="warning" size={18} color={colors.warning} />
          )}
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

  const containerStyle = [styles.card, isWarning && styles.warning]

  if (!onPress) {
    return <View style={[containerStyle, styles.static, style]}>{content}</View>
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
    onPress()
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start()
  }

  return (
    <Pressable onPressIn={breatheIn} onPressOut={breatheOut}>
      <Animated.View
        style={[
          containerStyle,
          styles.active,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
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
  },
  static: {
    backgroundColor: colors.grey7,
  },
  active: {
    backgroundColor: colors.grey5,
  },
  warning: {
    borderWidth: 1,
    borderColor: colors.warning,
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
    flex: 1,
    fontFamily: "SourceSansPro-Bold",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  body: {
    flex: 1,
  },
}))
