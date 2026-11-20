import { useCallback, useEffect, useRef, useState } from "react"
import { AccessibilityInfo, AppState, BackHandler, View } from "react-native"
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
/** How long a settled Sent stays on screen before it hands over to the receipt. */
export const SENT_HOLD_MS = 4000

/** The navigation actions a sender's back takes: the header arrow, the hardware back and
 *  the swipe. Receipt's reset and Close's pop to top are not among them. */
const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

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
 * state then holds for `SENT_HOLD_MS` and calls `onHoldEnd` (review opens the receipt), unless
 * the sender opens the receipt or closes first. The hold only counts while Sent can be seen:
 * leaving the app or covering review stops it, and it starts over on return.
 *
 * The timeline only ever plays where it can be seen. Reanimated stops drawing frames while
 * the app is in the background, and a play cut off there, or started there by a payment
 * that landed after the sender switched away, could come back half drawn: the details gone
 * and inert, the actions still invisible and back held, with nothing left to press. So a
 * play that loses the screen before it settles (the app leaving, or the lock screen coming
 * up over review) is rewound to the start, and plays again in full once review is in front
 * of the sender again.
 */
export const useSentTransition = ({ onHoldEnd }: { onHoldEnd?: () => void } = {}) => {
  const navigation = useNavigation()

  const onHoldEndRef = useRef(onHoldEnd)
  onHoldEndRef.current = onHoldEnd

  const stageRef = useRef<View>(null)
  const heroRef = useRef<View>(null)

  const [isSent, setIsSent] = useState(false)
  const [glowFrame, setGlowFrame] = useState<SentGlowFrame>()
  /** The play on screen, numbered so a replay redraws the badge; 0 while one waits. */
  const [sentPlay, setSentPlay] = useState(0)
  /** Whether review is in front of the sender; the hold only counts while it is. */
  const [isInView, setIsInView] = useState(true)
  /** With a screen reader on, Sent holds until the sender taps: a timer would move the
   *  screen away while they are still finding Receipt and Close. */
  const [isScreenReaderOn, setIsScreenReaderOn] = useState(false)
  /** Receipt and Close take touches and focus only once they start to fade in, not while
   *  they sit invisible over the slot the slider left. */
  const [areActionsLive, setAreActionsLive] = useState(false)
  /** Set the moment a landed payment is accepted, before Sent has measured or drawn
   *  anything: from then on the sender leaves through Receipt, Close or the hold only. */
  const isSettledRef = useRef(false)
  const [isSettled, setIsSettled] = useState(false)

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

  /** Read from a ref, so back is shut in the same tick success is accepted rather than on
   *  the render after it, while Sent is still measuring. */
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => isSettledRef.current,
    )
    const removeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
      if (!isSettledRef.current) return
      if (!BACKWARD_ACTIONS.includes(event.data.action.type)) return
      event.preventDefault()
    })
    return () => {
      subscription.remove()
      removeBeforeRemove()
    }
  }, [navigation])

  useEffect(() => {
    if (!isSettled) return
    // A screen option, not a header one: review has no native header to rebuild mid-animation.
    navigation.setOptions({ gestureEnabled: false })
  }, [isSettled, navigation])

  useEffect(() => {
    if (!sentPlay) {
      setAreActionsLive(false)
      return
    }
    const timer = setTimeout(() => setAreActionsLive(true), ACTIONS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [sentPlay])

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
    actionsProgress.value = withDelay(
      ACTIONS_DELAY_MS,
      withTiming(1, { duration: ACTIONS_FADE_MS, easing: Easing.out(Easing.quad) }),
    )
  }, [heroTravel, detailsProgress, heroProgress, actionsProgress])

  /** The glow only mounts with the commit that sets its frame, and on a first play that
   *  commit is the whole screen turning Sent: started in `play`, the bloom could run its
   *  course before the glow was there, which then only flashed. The frame and the play
   *  land in one batch, so this runs once per play, with the glow on screen. */
  useEffect(() => {
    if (!sentPlay) return
    glowProgress.value = withTiming(1, {
      duration: GLOW_BLOOM_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [sentPlay, glowProgress])

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
    const leave = () => {
      setIsInView(false)
      interrupt()
    }
    const comeBack = () => {
      setIsInView(canBeSeen())
      replayIfPending()
    }
    /** Any state but active covers review: iOS sits in inactive under Control Centre,
     *  Siri, the app switcher and the start of a lock. */
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") comeBack()
      else leave()
    })
    const removeBlurListener = navigation.addListener("blur", leave)
    const removeFocusListener = navigation.addListener("focus", comeBack)
    return () => {
      appStateSubscription.remove()
      removeBlurListener()
      removeFocusListener()
    }
  }, [navigation, interrupt, replayIfPending, canBeSeen])

  useEffect(() => {
    let isMounted = true
    AccessibilityInfo.isScreenReaderEnabled().then((isOn) => {
      if (isMounted) setIsScreenReaderOn(isOn)
    })
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsScreenReaderOn,
    )
    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  /** Counts the hold from the moment the play settles, or from now if it already has. */
  useEffect(() => {
    if (!sentPlay || !isInView || isScreenReaderOn) return
    const startedAt = playStartedAtRef.current ?? Date.now()
    const timelineLeft = Math.max(0, SENT_TIMELINE_MS - (Date.now() - startedAt))
    const timer = setTimeout(() => onHoldEndRef.current?.(), timelineLeft + SENT_HOLD_MS)
    return () => clearTimeout(timer)
  }, [sentPlay, isInView, isScreenReaderOn])

  const playSent = useCallback(
    async (amounts: SentAmounts) => {
      isSettledRef.current = true
      setIsSettled(true)
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

  /** What dissolves into Sent is only invisible, so a screen reader is kept off it too. */
  const goneWhenSent = {
    accessibilityElementsHidden: isSent,
    importantForAccessibility: isSent ? "no-hide-descendants" : "auto",
  } as const

  return {
    stageRef,
    heroRef,
    isSent,
    sentPlay,
    glowFrame,
    heroProgress,
    glowProgress,
    detailsStyle,
    goneWhenSent,
    heroStyle,
    actionsStyle,
    areActionsLive,
    playSent,
  }
}
