import { useCallback, useEffect, useRef, useState } from "react"
import { BackHandler, View } from "react-native"
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { useNavigation } from "@react-navigation/native"

import { sentHeroGrowth } from "../send-hero"

/** #1136 timeline: the details and hero start together, and the glow follows a beat later
 *  so it blooms behind a hero that is already on its way. */
const DETAILS_FADE_MS = 300
const HERO_MOVE_MS = 500
const GLOW_DELAY_MS = 200
const GLOW_BLOOM_MS = 600
/** The actions arrive once the hero has settled in the middle. */
const ACTIONS_DELAY_MS = HERO_MOVE_MS
const ACTIONS_FADE_MS = 300

type Frame = { x: number; y: number; width: number; height: number }

const measureInWindow = (view: View | null): Promise<Frame | undefined> =>
  new Promise((resolve) => {
    if (!view) {
      resolve(undefined)
      return
    }
    view.measureInWindow((...[x, y, width, height]) => resolve({ x, y, width, height }))
  })

export type SentGlowFrame = { centerX: number; centerY: number; radius: number }

/**
 * Review turns into the Sent screen in place: the details and slider dissolve, the hero
 * travels to the middle of the screen as it grows, and a glow blooms behind it. The Sent
 * state then holds until the sender opens the receipt or closes.
 */
export const useSentTransition = () => {
  const navigation = useNavigation()

  const stageRef = useRef<View>(null)
  const heroRef = useRef<View>(null)

  const [isSent, setIsSent] = useState(false)
  const [glowFrame, setGlowFrame] = useState<SentGlowFrame>()

  const heroProgress = useSharedValue(0)
  const detailsProgress = useSharedValue(0)
  const glowProgress = useSharedValue(0)
  const heroTravel = useSharedValue(0)
  const actionsProgress = useSharedValue(0)

  const detailsStyle = useAnimatedStyle(
    () => ({ opacity: 1 - detailsProgress.value }),
    [detailsProgress],
  )
  const actionsStyle = useAnimatedStyle(
    () => ({ opacity: actionsProgress.value }),
    [actionsProgress],
  )
  const heroStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: heroTravel.value * heroProgress.value }] }),
    [heroTravel, heroProgress],
  )

  useEffect(() => {
    if (!isSent) return
    // A screen option, not a header one: review has no native header to rebuild mid-animation.
    navigation.setOptions({ gestureEnabled: false })
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true)
    return () => subscription.remove()
  }, [isSent, navigation])

  const playSent = useCallback(
    async ({
      primaryAmount,
      hasSecondaryAmount,
    }: {
      primaryAmount: string
      hasSecondaryAmount: boolean
    }) => {
      const [stage, hero] = await Promise.all([
        measureInWindow(stageRef.current),
        measureInWindow(heroRef.current),
      ])

      if (stage && hero) {
        /** The stage runs the full screen, under the system bars, so its centre is the
         *  screen's. */
        const centerInStage = stage.height / 2
        const heroCenterWhenSent =
          hero.y -
          stage.y +
          (hero.height + sentHeroGrowth({ primaryAmount, hasSecondaryAmount })) / 2
        heroTravel.value = centerInStage - heroCenterWhenSent
        setGlowFrame({
          centerX: stage.width / 2,
          centerY: centerInStage,
          radius: stage.height,
        })
      }

      setIsSent(true)
      detailsProgress.value = withTiming(1, {
        duration: DETAILS_FADE_MS,
        easing: Easing.out(Easing.quad),
      })
      heroProgress.value = withTiming(1, {
        duration: HERO_MOVE_MS,
        easing: Easing.inOut(Easing.cubic),
      })
      glowProgress.value = withDelay(
        GLOW_DELAY_MS,
        withTiming(1, { duration: GLOW_BLOOM_MS, easing: Easing.out(Easing.quad) }),
      )
      actionsProgress.value = withDelay(
        ACTIONS_DELAY_MS,
        withTiming(1, { duration: ACTIONS_FADE_MS, easing: Easing.out(Easing.quad) }),
      )
    },
    [heroTravel, detailsProgress, heroProgress, glowProgress, actionsProgress],
  )

  return {
    stageRef,
    heroRef,
    isSent,
    glowFrame,
    heroProgress,
    glowProgress,
    detailsStyle,
    heroStyle,
    actionsStyle,
    playSent,
  }
}
