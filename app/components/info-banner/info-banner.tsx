import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

type InfoBannerProps = {
  children: React.ReactNode
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ children }) => {
  const styles = useStyles()

  return <View style={styles.container}>{children}</View>
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
}))
