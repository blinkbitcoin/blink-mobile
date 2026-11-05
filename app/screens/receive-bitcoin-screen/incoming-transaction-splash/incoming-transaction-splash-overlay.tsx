import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Canvas, RadialGradient, Rect, vec } from "@shopify/react-native-skia"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { SuccessBadge } from "@app/components/success-badge"
import { SuccessGlow } from "@app/components/success-glow"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

import type { ShownSplash } from "./incoming-transaction-splash-provider"
import { SplashCloseAction } from "./types"

const IRIS_MS = 480
const IRIS_OVERSHOOT = 40
const IRIS_FEATHER = 18
/** Never let the gradient radius reach 0: an animated RadialGradient at r=0 crashes
 *  Android's RNSVG/Skia path. */
const MIN_RADIUS = 1
const IRIS_EASING = Easing.bezier(0.55, 0, 0.85, 0.35)

const FADE_UP_MS = 320
const FADE_UP_OFFSET = 10
const FADE_UP_EASING = Easing.out(Easing.cubic)
const STAGGER_MS = 60
const SETTLE_MS = 900

/** Figma `pulse-anim`: a 1250 dp ring blooms out of the amount on impact and fades out. */
const PULSE_RADIUS = 625
const PULSE_MS = 700
const PULSE_EASING = Easing.out(Easing.cubic)

const BADGE_SIZE = 52

const REPLACE_FADE_MS = 140
const REPLACE_RING_MS = 380

const GLOW = "rgba(255, 255, 255, 0.35)"
const RING = "rgba(255, 255, 255, 0.25)"

type CloseAction = { optedOut: boolean; action: SplashCloseAction }

type Props = {
  splash: ShownSplash
  onClose: (action: CloseAction) => void
  onDetails: (action: { optedOut: boolean }) => void
  /** A tap showed a hidden amount, for analytics. */
  onReveal: () => void
}

const triggerSuccessHaptic = () => {
  // Honors the phone's system haptics setting, unlike the shared triggerHapticFeedback.
  ReactNativeHapticFeedback.trigger("notificationSuccess", {
    ignoreAndroidSystemSettings: false,
  })
}

const useFadeUpStyle = (progress: SharedValue<number>) =>
  useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * FADE_UP_OFFSET }],
  }))

export const IncomingTransactionSplashOverlay: React.FC<Props> = ({
  splash,
  onClose,
  onDetails,
  onReveal,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { formatCurrency, formatMoneyAmount } = useDisplayCurrency()

  /** What is on screen. Lags the prop during a replacement, until the old content has
   *  faded out. */
  const [displayed, setDisplayed] = useState(splash)
  const [optedOut, setOptedOut] = useState(false)
  /** A hidden amount shown with a tap. This screen only: the hide-balance setting and
   *  Home's own toggle are left as they are. Each new payment starts hidden again. */
  const [revealed, setRevealed] = useState(false)
  const [interactive, setInteractive] = useState(false)
  /** Bumped on every impact: remounts the badge so it draws itself in again. */
  const [impactKey, setImpactKey] = useState(0)
  /** Once the first iris lands the canvas is unmounted for good. */
  const [irisDone, setIrisDone] = useState(false)
  const [anchor, setAnchor] = useState({ x: width / 2, y: height / 2 })
  const amountRef = useRef<View>(null)
  const hasEntered = useRef(false)
  /** Animation callbacks land on the JS thread after the fact: an overlay dismissed
   *  mid-iris (backgrounded, locked) must not buzz or announce from beyond the grave. */
  const isMounted = useRef(true)

  const centerX = useSharedValue(width / 2)
  const centerY = useSharedValue(height / 2)
  const radius = useSharedValue(Math.hypot(width, height) + IRIS_OVERSHOOT)
  const ringRadius = useSharedValue(0)
  const ringOpacity = useSharedValue(0)
  const landed = useSharedValue(0)
  const pulse = useSharedValue(0)
  const content = useSharedValue(1)
  const badge = useSharedValue(0)
  const amountGroup = useSharedValue(0)
  const detailGroup = useSharedValue(0)
  const controls = useSharedValue(0)

  useEffect(
    () => () => {
      isMounted.current = false
      ;[radius, ringRadius, content, pulse, amountGroup, detailGroup, controls].forEach(
        (value) => cancelAnimation(value),
      )
    },
    // Shared values keep one identity for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const announce = useCallback(
    (shown: ShownSplash) => {
      if (shown.amountHidden) {
        // A hidden amount is not read out either.
        AccessibilityInfo.announceForAccessibility(
          LL.IncomingTransactionSplash.announcementHidden(),
        )
        return
      }
      const { settlementDisplayAmount, settlementDisplayCurrency } = shown.transaction
      AccessibilityInfo.announceForAccessibility(
        LL.IncomingTransactionSplash.announcement({
          amount: formatCurrency({
            amountInMajorUnits: settlementDisplayAmount,
            currency: settlementDisplayCurrency,
          }),
        }),
      )
    },
    [LL, formatCurrency],
  )

  const onImpact = useCallback(
    (shown: ShownSplash) => {
      if (!isMounted.current) return
      triggerSuccessHaptic()
      setImpactKey((key) => key + 1)
      setIrisDone(true)
      announce(shown)
      setTimeout(() => setInteractive(true), SETTLE_MS - IRIS_MS)
    },
    [announce],
  )

  const playEntrance = useCallback(() => {
    "worklet"
    badge.value = 1
    pulse.value = 0
    pulse.value = withTiming(1, { duration: PULSE_MS, easing: PULSE_EASING })
    const fadeUp = (step: number) =>
      withDelay(
        STAGGER_MS * step,
        withTiming(1, { duration: FADE_UP_MS, easing: FADE_UP_EASING }),
      )
    amountGroup.value = fadeUp(1)
    detailGroup.value = fadeUp(2)
    controls.value = fadeUp(3)
  }, [badge, pulse, amountGroup, detailGroup, controls])

  const startIris = useCallback(() => {
    if (hasEntered.current) return
    hasEntered.current = true
    radius.value = withTiming(
      MIN_RADIUS,
      { duration: IRIS_MS, easing: IRIS_EASING },
      (finished) => {
        if (!finished) return
        landed.value = 1
        playEntrance()
        runOnJS(onImpact)(splash)
      },
    )
  }, [radius, landed, playEntrance, onImpact, splash])

  /** The iris closes on the amount wherever it really sits: large fonts and long
   *  amounts move it. */
  const onAmountLayout = useCallback(() => {
    // eslint-disable-next-line max-params -- measureInWindow's callback signature
    amountRef.current?.measureInWindow((x, y, w, h) => {
      const cx = x + w / 2
      const cy = y + h / 2
      centerX.value = cx
      centerY.value = cy
      setAnchor({ x: cx, y: cy })
      const farthestCorner = Math.max(
        Math.hypot(cx, cy),
        Math.hypot(width - cx, cy),
        Math.hypot(cx, height - cy),
        Math.hypot(width - cx, height - cy),
      )
      if (!hasEntered.current) radius.value = farthestCorner + IRIS_OVERSHOOT
      startIris()
    })
  }, [centerX, centerY, radius, width, height, startIris])

  /** A new payment while open: fade out, a faint ring closes in, then the same impact
   *  and entrance with the new data. The checkbox carries over. */
  useEffect(() => {
    if (splash.transaction.id === displayed.transaction.id) {
      // The same payment with newer data (a note that arrived late): no replay.
      if (splash !== displayed) setDisplayed(splash)
      return
    }
    setInteractive(false)

    const showNext = () => {
      setRevealed(false)
      setDisplayed(splash)
    }
    const land = () => onImpact(splash)

    content.value = withTiming(0, { duration: REPLACE_FADE_MS }, (finished) => {
      if (!finished) return
      badge.value = 0
      amountGroup.value = 0
      detailGroup.value = 0
      controls.value = 0
      content.value = 1
      runOnJS(showNext)()
      ringOpacity.value = 1
      ringRadius.value = Math.hypot(width, height)
      ringRadius.value = withTiming(
        MIN_RADIUS,
        { duration: REPLACE_RING_MS, easing: IRIS_EASING },
        (done) => {
          if (!done) return
          ringOpacity.value = 0
          playEntrance()
          runOnJS(land)()
        },
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splash])

  const reveal = useCallback(() => {
    if (!interactive) return
    setRevealed(true)
    onReveal()
  }, [interactive, onReveal])

  const close = useCallback(
    (action: SplashCloseAction) => {
      if (interactive) onClose({ optedOut, action })
    },
    [interactive, onClose, optedOut],
  )

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close(SplashCloseAction.Back)
      return true
    })
    return () => subscription.remove()
  }, [close])

  const center = useDerivedValue(() => vec(centerX.value, centerY.value))
  const irisPositions = useDerivedValue(() => {
    const r = Math.max(radius.value, MIN_RADIUS)
    const inner = Math.max(0, (r - IRIS_FEATHER) / r)
    const glow = Math.max(inner, (r - IRIS_FEATHER / 2) / r)
    return [0, inner, glow, 1]
  })
  const irisRadius = useDerivedValue(() => Math.max(radius.value, MIN_RADIUS))
  /** The replacement ring is a plain bordered view, sized each frame, not a Skia stroke:
   *  the canvas is gone by then (see below). */
  const ringStyle = useAnimatedStyle(() => {
    const r = Math.max(ringRadius.value, MIN_RADIUS)
    return {
      opacity: ringOpacity.value,
      left: centerX.value - r,
      top: centerY.value - r,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
    }
  })

  const groundStyle = useAnimatedStyle(() => ({ opacity: landed.value }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }))
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badge.value }))
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 1 - pulse.value }))
  const amountGroupStyle = useFadeUpStyle(amountGroup)
  const detailGroupStyle = useFadeUpStyle(detailGroup)
  const controlsStyle = useFadeUpStyle(controls)

  const { settlementDisplayAmount, settlementDisplayCurrency, memo } =
    displayed.transaction
  const displayAmount = formatCurrency({
    amountInMajorUnits: settlementDisplayAmount,
    currency: settlementDisplayCurrency,
  })
  const satsAmount = formatMoneyAmount({
    moneyAmount: toBtcMoneyAmount(displayed.amountSats),
  })
  const masked = displayed.amountHidden && !revealed

  return (
    <View style={StyleSheet.absoluteFill} {...testProps("incoming-transaction-splash")}>
      {/* White icons on the green in both themes; unmounting restores the app's own. */}
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.ground, groundStyle]}
        pointerEvents="none"
      />
      <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]} pointerEvents="none">
        <SuccessGlow
          progress={pulse}
          centerX={anchor.x}
          centerY={anchor.y}
          radius={PULSE_RADIUS}
          innerColor="transparent"
          rimColor={colors._white}
        />
      </Animated.View>
      {/* Unmounted once it lands: Android composites a Skia canvas on its own surface,
          and one left on screen drops the overlay's grounds under some screens (Receive). */}
      {!irisDone && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={center}
              r={irisRadius}
              colors={["transparent", "transparent", GLOW, colors._green]}
              positions={irisPositions}
            />
          </Rect>
        </Canvas>
      )}
      <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />

      <Animated.View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
          contentStyle,
        ]}
        pointerEvents={interactive ? "box-none" : "none"}
      >
        <View style={styles.placeholder} />
        <View style={styles.body}>
          <Pressable
            style={styles.hero}
            onPress={reveal}
            disabled={!masked}
            accessible={masked}
            accessibilityRole={masked ? "button" : undefined}
            accessibilityLabel={
              masked ? LL.IncomingTransactionSplash.tapToShow() : undefined
            }
            testID="incoming-transaction-splash-reveal"
          >
            <Animated.View style={[styles.badge, badgeStyle]}>
              {impactKey > 0 && (
                <SuccessBadge key={impactKey} size={BADGE_SIZE} color={colors._white} />
              )}
            </Animated.View>
            <Animated.View style={[styles.text, amountGroupStyle]}>
              <Text type="p3" style={styles.white}>
                {LL.IncomingTransactionSplash.youReceived()}
              </Text>
              <View ref={amountRef} onLayout={onAmountLayout}>
                {masked ? (
                  <HiddenBalancePlaceholder size="large" color={colors._white} />
                ) : (
                  <Text
                    bold
                    style={[styles.white, styles.amount]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {displayAmount}
                  </Text>
                )}
              </View>
            </Animated.View>
            <Animated.View style={detailGroupStyle}>
              <Text type="p2" style={[styles.white, masked && styles.tapToShow]}>
                {masked ? LL.IncomingTransactionSplash.tapToShow() : satsAmount}
              </Text>
            </Animated.View>
          </Pressable>
          {memo ? (
            <Animated.View style={[styles.noteCard, detailGroupStyle]}>
              <Text type="p3" style={[styles.white, styles.noteLabel]}>
                {LL.IncomingTransactionSplash.note()}
              </Text>
              <Text
                type="p3"
                bold
                style={[styles.white, styles.noteValue]}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {memo}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.placeholder} />

        <Animated.View style={controlsStyle}>
          <View style={styles.checkboxRow}>
            <CheckboxRow
              label={LL.IncomingTransactionSplash.dontShowAgain()}
              isChecked={optedOut}
              onPress={() => setOptedOut((value) => !value)}
              color={colors._white}
              checkColor={colors._green}
              centered
              testID="incoming-transaction-splash-opt-out"
            />
          </View>
          <View style={styles.buttonGroup}>
            <GaloyPrimaryButton
              title={LL.common.close()}
              onPress={() => close(SplashCloseAction.Close)}
              buttonStyle={styles.closeButton}
              titleStyle={styles.closeButtonTitle}
              containerStyle={styles.fullWidth}
            />
            <GaloySecondaryButton
              title={LL.IncomingTransactionSplash.details()}
              onPress={() => interactive && onDetails({ optedOut })}
              titleStyle={styles.white}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.closeIcon, { top: insets.top + 14 }, controlsStyle]}
        >
          <GaloyIconButton
            name="close"
            size="medium"
            iconOnly
            backgroundColor={colors._green}
            color={colors._white}
            onPress={() => close(SplashCloseAction.X)}
            {...testProps("incoming-transaction-splash-close")}
          />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  ground: {
    backgroundColor: colors._green,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  placeholder: {
    flex: 1,
  },
  body: {
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 30,
  },
  hero: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  badge: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    alignItems: "center",
    gap: 14,
  },
  white: {
    color: colors._white,
    textAlign: "center",
  },
  amount: {
    fontSize: 32,
    lineHeight: 34,
  },
  tapToShow: {
    textTransform: "uppercase",
  },
  noteCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  noteLabel: {
    maxWidth: 100,
    textAlign: "left",
  },
  noteValue: {
    flex: 1,
    textAlign: "right",
  },
  checkboxRow: {
    paddingVertical: 20,
    alignItems: "center",
  },
  buttonGroup: {
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  // Same size and type as GaloyPrimaryButton's own styles, which a buttonStyle /
  // titleStyle prop replaces rather than merges: only the colours differ here.
  closeButton: {
    minHeight: 50,
    backgroundColor: colors._black,
  },
  closeButtonTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: colors._white,
  },
  closeIcon: {
    position: "absolute",
    right: 20,
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: RING,
  },
}))
