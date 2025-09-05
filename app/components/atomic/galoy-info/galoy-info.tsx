import React, { ReactNode } from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type GaloyInfoProps = {
  highlight?: boolean
  isWarning?: boolean
  children: ReactNode
}

export const GaloyInfo: React.FC<GaloyInfoProps> = ({ children, isWarning }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles({ isWarning })

  return (
    <View style={styles.container}>
      <View style={styles.verticalLine} />
      <View style={styles.infoContainer}>
        <Text
          style={styles.textContainer}
          type={"p3"}
          color={isWarning ? colors.warning : colors.blue5}
        >
          {children}
        </Text>
      </View>
    </View>
  )
}

type StyleProps = {
  isWarning?: boolean
}

const useStyles = makeStyles(({ colors }, props: StyleProps) => ({
  container: {
    flexDirection: "row",
  },
  infoContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.grey5,
  },
  verticalLine: {
    width: 3,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    backgroundColor: props.isWarning ? colors.warning : colors.blue5,
    height: "100%",
  },
  textContainer: {
    overflow: "hidden",
  },
}))
