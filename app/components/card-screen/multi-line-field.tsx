import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

type MultiLineFieldProps = {
  lines: string[]
  leftIcon?: IconNamesType
  rightIcon?: IconNamesType
  onPress?: () => void
}

export const MultiLineField: React.FC<MultiLineFieldProps> = ({
  lines,
  leftIcon,
  rightIcon,
  onPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const content = (
    <View style={styles.container}>
      {leftIcon && <GaloyIcon name={leftIcon} size={16} />}
      <View style={styles.textContainer}>
        {lines.map((line, index) => (
          <Text key={index} style={styles.text}>
            {line}
          </Text>
        ))}
      </View>
      {rightIcon && <GaloyIcon name={rightIcon} size={20} color={colors.primary} />}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={lines.join(", ")}
      >
        {content}
      </Pressable>
    )
  }

  return content
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 14,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
}))
