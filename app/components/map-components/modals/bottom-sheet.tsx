import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Dimensions, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { RootSiblingPortal } from "react-native-root-siblings"
import { makeStyles, useTheme } from "@rn-vui/themed"

const { height: SCREEN_HEIGHT } = Dimensions.get("window")

const DEFAULT_PEEK_HEIGHT = 175
const HANDLE_HEIGHT = 28

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
  mass: 0.5,
}

const CLOSE_SPRING_CONFIG = {
  damping: 25,
  stiffness: 200,
  mass: 0.4,
}

type Props = {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /** Content rendered above the sheet, moves with it (e.g. floating action button) */
  renderAbove?: React.ReactNode
  /** Custom peek height in px (default 175) */
  peekHeight?: number
  /** Custom expanded height in px (default 60% of screen) */
  expandedHeight?: number
}

const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  children,
  renderAbove,
  peekHeight: peekHeightProp,
  expandedHeight: expandedHeightProp,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const [mounted, setMounted] = useState(false)

  const peek = peekHeightProp ?? DEFAULT_PEEK_HEIGHT
  const expanded = expandedHeightProp ?? Math.round(SCREEN_HEIGHT * 0.6)
  const closedY = SCREEN_HEIGHT
  const peekY = SCREEN_HEIGHT - peek
  const expandedY = SCREEN_HEIGHT - expanded
  const snapPoints = useMemo(
    () => [closedY, peekY, expandedY],
    [closedY, peekY, expandedY],
  )

  const translateY = useSharedValue(closedY)
  const contextY = useSharedValue(0)

  const unmount = useCallback(() => {
    setMounted(false)
  }, [])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      translateY.value = withSpring(peekY, SPRING_CONFIG)
    } else {
      translateY.value = withSpring(closedY, CLOSE_SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(unmount)()
        }
      })
    }
  }, [visible, unmount, peekY])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const gesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value
    })
    .onUpdate((event) => {
      const newY = contextY.value + event.translationY
      translateY.value = Math.max(expandedY, Math.min(newY, closedY))
    })
    .onEnd((event) => {
      const currentY = translateY.value
      const velocity = event.velocityY

      if (velocity > 500) {
        translateY.value = withSpring(closedY, CLOSE_SPRING_CONFIG)
        runOnJS(handleClose)()
        return
      }

      if (velocity < -500) {
        translateY.value = withSpring(expandedY, SPRING_CONFIG)
        return
      }

      let closest = snapPoints[0]
      let minDist = Math.abs(currentY - snapPoints[0])
      // eslint-disable-next-line no-plusplus
      for (let i = 1; i < snapPoints.length; i++) {
        const dist = Math.abs(currentY - snapPoints[i])
        if (dist < minDist) {
          minDist = dist
          closest = snapPoints[i]
        }
      }

      translateY.value = withSpring(
        closest,
        closest === closedY ? CLOSE_SPRING_CONFIG : SPRING_CONFIG,
      )
      if (closest === closedY) {
        runOnJS(handleClose)()
      }
    })

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    top: translateY.value,
  }))

  const aboveAnimatedStyle = useAnimatedStyle(() => ({
    top: translateY.value - 51,
  }))

  if (!mounted) {
    return null
  }

  return (
    <RootSiblingPortal>
      <View style={styles.portalOverlay} pointerEvents="box-none">
        {/* Sheet body – no GestureDetector parent so ScrollView works */}
        <Animated.View
          style={[
            styles.container,
            { height: expanded, backgroundColor: colors.white, borderColor: colors.grey4 },
            sheetAnimatedStyle,
          ]}
        >
          <View style={styles.handleSpacer} />
          <View style={styles.content}>{children}</View>
        </Animated.View>

        {/* Floating content above the sheet */}
        {renderAbove && (
          <Animated.View style={[styles.aboveContainer, aboveAnimatedStyle]} pointerEvents="box-none">
            {renderAbove}
          </Animated.View>
        )}

        {/* Handle overlay – only this has pan gesture */}
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[styles.handleOverlay, { height: HANDLE_HEIGHT }, sheetAnimatedStyle]}
          >
            <View style={[styles.handle, { backgroundColor: colors.grey3 }]} />
          </Animated.View>
        </GestureDetector>
      </View>
    </RootSiblingPortal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  portalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    zIndex: 500,
  },
  handleSpacer: {
    height: HANDLE_HEIGHT,
  },
  aboveContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 502,
  },
  handleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 501,
  },
  handle: {
    width: 26,
    height: 3,
    borderRadius: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
}))

export default BottomSheet
