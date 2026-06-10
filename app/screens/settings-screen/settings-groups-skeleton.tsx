import * as React from "react"
import { View, useWindowDimensions } from "react-native"
import ContentLoader, { Rect } from "react-content-loader/native"

import { makeStyles } from "@rn-vui/themed"

const SettingsGroupsSkeleton: React.FC = () => {
  const styles = useStyles()
  const { height } = useWindowDimensions()

  return (
    <View style={styles.container}>
      <ContentLoader
        height={height}
        width="100%"
        speed={1.2}
        backgroundColor={styles.background.color}
        foregroundColor={styles.foreground.color}
      >
        <Rect x="0" y="0" rx="12" ry="12" width="100%" height="174" />
        <Rect x="0" y="192" rx="12" ry="12" width="100%" height="232" />
        <Rect x="0" y="442" rx="12" ry="12" width="100%" height="348" />
      </ContentLoader>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    alignSelf: "stretch",
  },
  background: {
    color: colors.loaderBackground,
  },
  foreground: {
    color: colors.loaderForeground,
  },
}))

export default SettingsGroupsSkeleton
