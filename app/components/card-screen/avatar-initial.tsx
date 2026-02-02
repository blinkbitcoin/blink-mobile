import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

type AvatarInitialProps = {
  name: string
  size?: number
}

export const AvatarInitial: React.FC<AvatarInitialProps> = ({ name, size = 52 }) => {
  const styles = useStyles({ size })
  const {
    theme: { colors },
  } = useTheme()
  const initial = name.trim().charAt(0).toUpperCase()
  const accessibilityLabel = initial ? `Initial ${initial} for ${name}` : "User icon"

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      {initial ? (
        <Text style={styles.text} accessible={false}>
          {initial}
        </Text>
      ) : (
        <GaloyIcon name="user" size={size * 0.5} color={colors.primary} />
      )}
    </View>
  )
}

type StyleProps = {
  size: number
}

const useStyles = makeStyles(({ colors }, { size }: StyleProps) => ({
  container: {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.primary,
    fontSize: size * 0.65,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: size * 0.87,
  },
}))
