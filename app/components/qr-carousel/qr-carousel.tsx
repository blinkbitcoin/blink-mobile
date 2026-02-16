import React, { forwardRef, useMemo } from "react"
import { StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native"
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel"
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated"

import { makeStyles } from "@rn-vui/themed"

// Ratios based on design spec (360px reference width)
const QR_TO_SCREEN_RATIO = 250 / 360
const PARALLAX_TO_SCREEN_RATIO = 94 / 360
const PAGES = [0, 1]

type QRCarouselProps = {
  page0: React.ReactNode
  page1: React.ReactNode
  onSnap: (index: number) => void
}

const CarouselItem: React.FC<{
  animationValue: SharedValue<number>
  children: React.ReactNode
  pageStyle: ViewStyle | ViewStyle[]
  overlayStyle: ViewStyle
}> = ({ animationValue, children, pageStyle, overlayStyle }) => {
  const animatedOverlay = useAnimatedStyle(() => ({
    opacity: interpolate(animationValue.value, [-1, 0, 1], [0.5, 0, 0.5]),
  }))

  return (
    <View style={pageStyle}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, overlayStyle, animatedOverlay]}
      />
    </View>
  )
}

export const QRCarousel = forwardRef<ICarouselInstance, QRCarouselProps>(
  ({ page0, page1, onSnap }, ref) => {
    const styles = useStyles()
    const { width: screenWidth } = useWindowDimensions()

    const qrContainerSize = useMemo(
      () => Math.round(QR_TO_SCREEN_RATIO * screenWidth),
      [screenWidth],
    )
    const parallaxOffset = useMemo(
      () => Math.round(PARALLAX_TO_SCREEN_RATIO * screenWidth),
      [screenWidth],
    )

    const renderItem = ({
      index,
      animationValue,
    }: {
      index: number
      animationValue: SharedValue<number>
    }) => (
      <CarouselItem
        animationValue={animationValue}
        pageStyle={[styles.page, { width: qrContainerSize, height: qrContainerSize }]}
        overlayStyle={styles.overlay}
      >
        {index === 0 ? page0 : page1}
      </CarouselItem>
    )

    return (
      <Carousel
        ref={ref}
        data={PAGES}
        renderItem={renderItem}
        width={screenWidth}
        height={qrContainerSize}
        loop={false}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 1,
          parallaxScrollingOffset: parallaxOffset,
        }}
        onSnapToItem={onSnap}
      />
    )
  },
)
QRCarousel.displayName = "QRCarousel"

const useStyles = makeStyles(({ colors }) => ({
  page: {
    alignSelf: "center",
  },
  overlay: {
    backgroundColor: colors.background,
    borderRadius: 20,
  },
}))
