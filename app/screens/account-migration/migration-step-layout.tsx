import React, { useCallback, useRef } from "react"
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"

/** Rounding and bounce leave the offset a hair short of the exact bottom. */
const AT_BOTTOM_SLACK = 8

type MigrationStepLayoutProps = {
  children: React.ReactNode
  footer: React.ReactNode
  header?: React.ReactNode
  headerShown?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * The migration flow's shared step scaffold: an optional header row, the step content,
 * and the footer actions pinned to the bottom with the flow's spacing.
 *
 * The content scrolls so that enlarged system text can never push it into the footer,
 * and the footer is a sibling below the scroll view rather than an overlay, so the
 * scroll area is always whatever height the buttons leave behind.
 *
 * Content that grows while the user is already at the bottom pulls the view down with
 * it. The explainer step reveals its acknowledgement boxes one at a time, and at large
 * text sizes the next box lands off-screen; without this the user sees the CTA stay
 * disabled with no visible reason why.
 */
export const MigrationStepLayout: React.FC<MigrationStepLayoutProps> = ({
  children,
  footer,
  header,
  headerShown,
  contentStyle,
}) => {
  const styles = useStyles()

  const scrollRef = useRef<ScrollView>(null)
  const contentHeightRef = useRef(0)
  const isAtBottomRef = useRef(true)

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
    isAtBottomRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - AT_BOTTOM_SLACK
  }, [])

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    const previousHeight = contentHeightRef.current
    contentHeightRef.current = height

    // The first measurement is the initial layout, not growth — following it
    // would drop the user at the bottom of a screen they have not read yet.
    if (previousHeight === 0) return

    if (height > previousHeight && isAtBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: true })
    }
  }, [])

  return (
    <Screen preset="fixed" headerShown={headerShown}>
      <View style={styles.container}>
        {header}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {children}
        </ScrollView>
        <View style={styles.buttonsContainer}>{footer}</View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  scroll: {
    flex: 1,
  },
  content: {
    // flexGrow rather than flex so short content keeps today's full-height box
    // while tall content is allowed to grow past the viewport and scroll.
    flexGrow: 1,
    paddingBottom: 10,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    // The band paints its own surface rather than leaning on the screen showing
    // through: a disabled primary button is a translucent fill, so whatever is
    // visible behind the band would be visible through the button.
    backgroundColor: colors.white,
  },
}))
