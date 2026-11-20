import React, { useEffect, useRef, useState } from "react"
import { LayoutChangeEvent, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { useAccessibilityAnnouncement } from "@app/hooks/use-accessibility-announcement"
import { triggerHapticFeedback } from "@app/utils/helper"

import { IconHero } from "../icon-hero"
import { Screen } from "../screen"
import { SUCCESS_BADGE_DURATION_MS, SuccessBadge } from "../success-badge"
import { SuccessGlow } from "../success-glow"

/** Figma's badge sits in a 72 frame, as on Sent. */
const ICON_FRAME_SIZE = 72
const BADGE_SIZE = 49
/** The glow blooms as on Sent (#4342). */
const GLOW_BLOOM_MS = 600
/** The text follows the badge: it rises once the check has landed, as the pop starts. */
const SLIDE_DELAY_MS = 850
const SLIDE_MS = 120
const SLIDE_DISTANCE = 16
/** How long a settled screen with no actions stays up before it moves on. */
export const SUCCESS_HOLD_MS = 3000
/** From mount to the screen moving on by itself. */
export const SUCCESS_SCREEN_EXIT_MS = SUCCESS_BADGE_DURATION_MS + SUCCESS_HOLD_MS

export const SUCCESS_SCREEN_TEST_ID = "success-screen"

type SuccessScreenProps = {
  title: string
  subtitle?: string
  /** Anything the screen adds under the title. */
  children?: React.ReactNode
  /** The primary and secondary buttons. A screen with actions waits for a tap. */
  actions?: React.ReactNode
  /** Called once the badge has settled and held, on screens with no actions. */
  onHoldEnd?: () => void
}

/**
 * The one "it worked" screen: the success badge drawing itself in over a glow, a bold title
 * and whatever the caller adds rising in under it. A screen with no actions moves on by
 * itself `SUCCESS_HOLD_MS` after the badge settles, screen reader on or not; the title and
 * subtitle are spoken as it opens. Reanimated's default reduce-motion handling jumps every step to its
 * end.
 */
export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  title,
  subtitle,
  children,
  actions,
  onHoldEnd,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { top, bottom } = useSafeAreaInsets()

  const [size, setSize] = useState<{ width: number; height: number }>()
  const glowProgress = useSharedValue(0)
  const slideProgress = useSharedValue(0)

  const onHoldEndRef = useRef(onHoldEnd)
  onHoldEndRef.current = onHoldEnd
  const hasActions = Boolean(actions)
  const hasSize = Boolean(size)

  /** Title and subtitle are one element, and spoken together as the screen opens. */
  const label = [title, subtitle].filter(Boolean).join(", ")
  useAccessibilityAnnouncement(label)

  useEffect(() => {
    triggerHapticFeedback("notificationSuccess")
    slideProgress.value = withDelay(
      SLIDE_DELAY_MS,
      withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.quad) }),
    )
  }, [slideProgress])

  /** The glow can only mount once the screen is measured, so it blooms from then, as Sent
   *  blooms once it has measured. Started at mount, a slow first open spent the bloom
   *  before the glow was there and showed only its end, a flash. */
  useEffect(() => {
    if (!hasSize) return
    glowProgress.value = withTiming(1, {
      duration: GLOW_BLOOM_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [hasSize, glowProgress])

  useEffect(() => {
    if (hasActions) return
    const timer = setTimeout(() => onHoldEndRef.current?.(), SUCCESS_SCREEN_EXIT_MS)
    return () => clearTimeout(timer)
  }, [hasActions])

  const slideStyle = useAnimatedStyle(
    () => ({
      opacity: slideProgress.value,
      transform: [{ translateY: SLIDE_DISTANCE * (1 - slideProgress.value) }],
    }),
    [slideProgress],
  )

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setSize({ width: layout.width, height: layout.height })

  /** Edge to edge, so the glow runs under the system bars; the content pads itself clear
   *  of them. */
  return (
    <Screen preset="fixed" unsafe headerShown={false}>
      <View
        style={[styles.screen, { paddingTop: top, paddingBottom: bottom }]}
        onLayout={onLayout}
        testID={SUCCESS_SCREEN_TEST_ID}
      >
        {size ? (
          <SuccessGlow
            progress={glowProgress}
            centerX={size.width / 2}
            centerY={size.height / 2}
            radius={size.height}
          />
        ) : null}
        <View style={styles.body}>
          <IconHero
            icon={<SuccessBadge size={BADGE_SIZE} />}
            iconColor={colors.success}
            hasIconBackground={false}
            compact
            iconFrameStyle={styles.iconFrame}
            title={
              <Animated.View style={[styles.text, slideStyle]}>
                <View
                  style={styles.text}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={label}
                >
                  <Text type="h2" bold style={styles.centred}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text type="p1" style={styles.centred}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {children}
              </Animated.View>
            }
          />
        </View>
        {actions ? (
          <Animated.View style={[styles.actions, slideStyle]}>{actions}</Animated.View>
        ) : null}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundDefault,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconFrame: {
    width: ICON_FRAME_SIZE,
    height: ICON_FRAME_SIZE,
    borderRadius: ICON_FRAME_SIZE / 2,
  },
  text: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 14,
  },
  /** The full width, as IconHero's own title: in a centred column Android measures a
   *  bold line at its natural width and clips the last word it wraps. */
  centred: {
    textAlign: "center",
    width: "100%",
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
}))
