import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, BackHandler, View } from "react-native"
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { useNavigation } from "@react-navigation/native"

import { SENT_BADGE_END_MS, sentHeroGrowth } from "../send-hero"

/** #1136 timeline: the details, the hero and the glow all start the moment the payment
 *  lands. */
const DETAILS_FADE_MS = 300
const HERO_MOVE_MS = 500
const GLOW_BLOOM_MS = 600
/** The actions arrive once the hero has settled in the middle. */
const ACTIONS_DELAY_MS = HERO_MOVE_MS
const ACTIONS_FADE_MS = 300
/** From the payment landing to the last of it settling. */
export const SENT_TIMELINE_MS = Math.max(
  HERO_MOVE_MS,
  GLOW_BLOOM_MS,
  ACTIONS_DELAY_MS + ACTIONS_FADE_MS,
  SENT_BADGE_END_MS,
)

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

type SentAmounts = { primaryAmount: string; hasSecondaryAmount: boolean }

/**
 * Review turns into the Sent screen in place: the details and slider dissolve, the hero
 * travels to the middle of the screen as it grows, and a glow blooms behind it. The Sent
 * state then holds until the sender opens the receipt or closes.
 *
 * The timeline only ever plays where it can be seen. Reanimated stops drawing frames while
 * the app is in the background, and a play cut off there, or started there by a payment
 * that landed after the sender switched away, could come back half drawn: the details gone
 * and inert, the actions still invisible and back held, with nothing left to press. So a
 * play that loses the screen before it settles (the app leaving, or the lock screen coming
 * up over review) is rewound to the start, and plays again in full once review is in front
 * of the sender again.
 */
export const useSentTransition = () => {
  const navigation = useNavigation()

  const stageRef = useRef<View>(null)
  const heroRef = useRef<View>(null)

  const [isSent, setIsSent] = useState(false)
  const [glowFrame, setGlowFrame] = useState<SentGlowFrame>()
  /** The play on screen, numbered so a replay redraws the badge; 0 while one waits. */
  const [sentPlay, setSentPlay] = useState(0)

  const amountsRef = useRef<SentAmounts>(undefined)
  /** Bumped by every play and every rewind, so a play still measuring knows it lost. */
  const playIdRef = useRef(0)
  /** When the current play started; null while none has, or since one was rewound. */
  const playStartedAtRef = useRef<number | null>(null)
  const isReplayPendingRef = useRef(false)

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

  const rewind = useCallback(() => {
    playIdRef.current += 1
    playStartedAtRef.current = null
    for (const progress of [
      detailsProgress,
      heroProgress,
      glowProgress,
      actionsProgress,
    ]) {
      cancelAnimation(progress)
      progress.value = 0
    }
    setSentPlay(0)
  }, [detailsProgress, heroProgress, glowProgress, actionsProgress])

  const play = useCallback(async () => {
    const amounts = amountsRef.current
    if (!amounts) return
    isReplayPendingRef.current = false
    playIdRef.current += 1
    const playId = playIdRef.current
    playStartedAtRef.current = Date.now()

    /** Measured on every play, with the hero rewound to its review position. */
    const [stage, hero] = await Promise.all([
      measureInWindow(stageRef.current),
      measureInWindow(heroRef.current),
    ])
    if (playId !== playIdRef.current) return

    if (stage && hero) {
      /** The stage runs the full screen, under the system bars, so its centre is the
       *  screen's. */
      const centerInStage = stage.height / 2
      const heroCenterWhenSent =
        hero.y - stage.y + (hero.height + sentHeroGrowth(amounts)) / 2
      heroTravel.value = centerInStage - heroCenterWhenSent
      setGlowFrame({
        centerX: stage.width / 2,
        centerY: centerInStage,
        radius: stage.height,
      })
    }

    setIsSent(true)
    setSentPlay(playId)
    detailsProgress.value = withTiming(1, {
      duration: DETAILS_FADE_MS,
      easing: Easing.out(Easing.quad),
    })
    heroProgress.value = withTiming(1, {
      duration: HERO_MOVE_MS,
      easing: Easing.inOut(Easing.cubic),
    })
    glowProgress.value = withTiming(1, {
      duration: GLOW_BLOOM_MS,
      easing: Easing.out(Easing.quad),
    })
    actionsProgress.value = withDelay(
      ACTIONS_DELAY_MS,
      withTiming(1, { duration: ACTIONS_FADE_MS, easing: Easing.out(Easing.quad) }),
    )
  }, [heroTravel, detailsProgress, heroProgress, glowProgress, actionsProgress])

  const canBeSeen = useCallback(
    () => AppState.currentState === "active" && navigation.isFocused(),
    [navigation],
  )

  /** A settled play is left alone: only one still under way is taken back. */
  const interrupt = useCallback(() => {
    const startedAt = playStartedAtRef.current
    if (startedAt === null || Date.now() - startedAt >= SENT_TIMELINE_MS) return
    rewind()
    isReplayPendingRef.current = true
  }, [rewind])

  const replayIfPending = useCallback(() => {
    if (isReplayPendingRef.current && canBeSeen()) play()
  }, [canBeSeen, play])

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "background") interrupt()
      if (state === "active") replayIfPending()
    })
    const removeBlurListener = navigation.addListener("blur", interrupt)
    const removeFocusListener = navigation.addListener("focus", replayIfPending)
    return () => {
      appStateSubscription.remove()
      removeBlurListener()
      removeFocusListener()
    }
  }, [navigation, interrupt, replayIfPending])

  const playSent = useCallback(
    async (amounts: SentAmounts) => {
      amountsRef.current = amounts
      if (canBeSeen()) {
        await play()
        return
      }
      /** Landed while the sender was away: Sent waits, rewound, for them to come back. */
      setIsSent(true)
      isReplayPendingRef.current = true
    },
    [canBeSeen, play],
  )

  return {
    stageRef,
    heroRef,
    isSent,
    sentPlay,
    glowFrame,
    heroProgress,
    glowProgress,
    detailsStyle,
    heroStyle,
    actionsStyle,
    playSent,
  }
}
