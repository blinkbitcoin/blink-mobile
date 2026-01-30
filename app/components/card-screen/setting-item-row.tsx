import React, { useState } from "react"
import { Pressable, StyleProp, TextStyle, View } from "react-native"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

const ICON_SIZE = 16

type StyleProps = {
  hovering: boolean
  hasSubtitle: boolean
}

type SettingItemRowProps = {
  title: string
  subtitle?: string
  leftIcon?: IconNamesType
  leftIonicon?: string
  leftIconColor?: string
  titleStyle?: StyleProp<TextStyle>
  subtitleStyle?: StyleProp<TextStyle>
  rightIcon?: IconNamesType | null
  rightIconColor?: string
  onPress?: () => void
}

export const SettingItemRow: React.FC<SettingItemRowProps> = ({
  title,
  subtitle,
  leftIcon,
  leftIonicon,
  leftIconColor,
  titleStyle,
  subtitleStyle,
  rightIcon = "caret-right",
  rightIconColor,
  onPress,
}) => {
  const [hovering, setHovering] = useState(false)
  const hasSubtitle = Boolean(subtitle)
  const styles = useStyles({ hovering, hasSubtitle })
  const {
    theme: { colors },
  } = useTheme()

  const iconColor = leftIconColor ?? colors.black

  const renderLeftIcon = () => {
    if (leftIcon) {
      return <GaloyIcon name={leftIcon} size={ICON_SIZE} color={iconColor} />
    }
    if (leftIonicon) {
      return <Icon name={leftIonicon} type="ionicon" size={ICON_SIZE} color={iconColor} />
    }
    return null
  }

  const content = (
    <>
      {renderLeftIcon()}
      <View style={styles.textContainer}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
      </View>
      {rightIcon && (
        <GaloyIcon
          name={rightIcon}
          size={ICON_SIZE}
          color={rightIconColor ?? colors.primary}
        />
      )}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        style={styles.container}
        onPress={onPress}
        onPressIn={() => setHovering(true)}
        onPressOut={() => setHovering(false)}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.container}>{content}</View>
}

const useStyles = makeStyles(({ colors }, { hovering, hasSubtitle }: StyleProps) => {
  const baseBackground = hasSubtitle ? colors.grey5 : colors.transparent

  return {
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: hovering ? colors.grey4 : baseBackground,
      borderRadius: hasSubtitle ? 8 : 0,
      paddingVertical: 14,
      paddingLeft: 14,
      paddingRight: 10,
      gap: 14,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      color: colors.black,
      fontFamily: "Source Sans Pro",
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
    subtitle: {
      color: colors.grey2,
      fontFamily: "Source Sans Pro",
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
  }
})
