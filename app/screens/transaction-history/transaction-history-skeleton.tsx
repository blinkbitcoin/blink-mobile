import * as React from "react"
import { View } from "react-native"
import ContentLoader, { Rect } from "react-content-loader/native"
import { makeStyles } from "@rn-vui/themed"

const TransactionHistorySkeleton = () => {
  const styles = useStyles()
  return (
    <View style={styles.skeletonWrapper}>
      <ContentLoader
        height={640}
        width={"100%"}
        speed={1.2}
        backgroundColor={styles.loaderBackground.color}
        foregroundColor={styles.loaderForefound.color}
        viewBox="0 0 100% 640"
      >
        <Rect x="0" y="40" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="102" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="164" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="226" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="288" rx="10" ry="10" width="100%" height="60" />
        <Rect x="0" y="350" rx="10" ry="10" width="100%" height="60" />
      </ContentLoader>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  skeletonWrapper: { flex: 1, alignSelf: "stretch" },
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForefound: {
    color: colors.loaderForeground,
  },
}))

export default TransactionHistorySkeleton
