import React from "react"
import { Pressable, View } from "react-native"

import { Colors, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type ThemeColor = keyof Colors

type SettingsCardProps = {
  icon?: IconNamesType
  title: string
  description: string
  onPress: () => void
  borderColor?: ThemeColor
  iconColor?: ThemeColor
  titleColor?: ThemeColor
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  icon,
  title,
  description,
  onPress,
  borderColor,
  iconColor,
  titleColor,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const resolvedBorder = borderColor ? String(colors[borderColor]) : undefined
  const resolvedIcon = iconColor ? String(colors[iconColor]) : String(colors.grey2)
  const resolvedTitle = titleColor ? String(colors[titleColor]) : undefined

  const styles = useStyles({ borderColor: resolvedBorder })

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        {icon && <GaloyIcon name={icon} size={20} color={resolvedIcon} />}
        <View style={styles.textContainer}>
          <Text style={[styles.title, resolvedTitle ? { color: resolvedTitle } : null]}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <GaloyIcon name="caret-right" size={20} color={String(colors.primary)} />
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }, { borderColor }: { borderColor?: string }) => ({
  container: {
    borderRadius: 12,
    backgroundColor: colors.grey5,
    padding: 14,
    borderWidth: borderColor ? 1 : 0,
    borderColor: borderColor ?? "transparent",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.black,
  },
  description: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: colors.black,
  },
}))
