import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { makeStyles } from "@rn-vui/themed"

type PhoneInputSkeletonProps = {
  height?: number
  speed?: number
}

const PhoneInputSkeleton: React.FC<PhoneInputSkeletonProps> = ({
  height = 60,
  speed = 0.6,
}) => {
  const styles = useStyles()

  return (
    <ContentLoader
      height={height}
      width="100%"
      speed={speed}
      backgroundColor={styles.background.color}
      foregroundColor={styles.foreground.color}
    >
      <Rect x="0" y="0" rx="8" ry="8" width="100%" height={height} />
    </ContentLoader>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  background: {
    color: colors.loaderBackground,
  },
  foreground: {
    color: colors.loaderForeground,
  },
}))

export default PhoneInputSkeleton
