import React, { useEffect } from "react"
import { Pressable, View } from "react-native"
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { IconHero } from "@app/components/icon-hero"
import { SuccessBadge } from "@app/components/success-badge"
import { fonts } from "@app/rne-theme/fonts"
import { testProps } from "@app/utils/testProps"

export const SEND_HERO_CAPTION_TEST_ID = "send-hero-caption"
export const SEND_HERO_PRIMARY_TEST_ID = "send-hero-amount-primary"
export const SEND_HERO_SECONDARY_TEST_ID = "send-hero-amount-secondary"

const ICON_SIZE = 32

/**
 * Amount entry leads with the amount being typed, review reads it back at heading size.
 * Both are the same block, so the amount does not move as the sender goes from one to the
 * other — only its scale changes.
 */
const AMOUNT_SIZE = {
  active: { secondary: 18 },
  inactive: { primary: 20, secondary: 14 },
} as const
const LINE_HEIGHT = {
  active: { secondary: 24 },
  inactive: { primary: 24, secondary: 20 },
} as const

/**
 * While the amount is typed it holds full size for the first five digits, then steps down
 * evenly with each further digit, so a long amount still fits on one line: 36 up to five
 * digits (12,345), 22 from ten digits (1,000,000,000) on.
 */
const ENTRY_AMOUNT_SIZE = { max: 36, min: 22 } as const
const ENTRY_AMOUNT_MAX_SIZE_DIGITS = 5
const ENTRY_AMOUNT_MIN_SIZE_DIGITS = 10
const ENTRY_LINE_HEIGHT_OFFSET = 2

export const entryAmountFontSize = (amount: string, isEmpty: boolean): number => {
  if (isEmpty) return ENTRY_AMOUNT_SIZE.max
  const digits = amount.replace(/\D/g, "").length
  const progress = Math.min(
    Math.max(digits - ENTRY_AMOUNT_MAX_SIZE_DIGITS, 0) /
      (ENTRY_AMOUNT_MIN_SIZE_DIGITS - ENTRY_AMOUNT_MAX_SIZE_DIGITS),
    1,
  )
  return Math.round(
    ENTRY_AMOUNT_SIZE.max - (ENTRY_AMOUNT_SIZE.max - ENTRY_AMOUNT_SIZE.min) * progress,
  )
}

const SWAP_ANIMATION_MS = 220

/**
 * Once the payment is sent the settled read-out grows into the centred Sent hero: each line
 * runs from its review size to its sent size as `sentProgress` goes from 0 to 1.
 */
const CAPTION_SIZE = { review: 12, sent: 16 } as const
const CAPTION_LINE_HEIGHT = { review: 18, sent: 22 } as const
const SENT_AMOUNT_SIZE = { secondary: 16 } as const
const SENT_LINE_HEIGHT = { secondary: 22 } as const

/** Figma's sent badge sits in a 72 frame, 20 off the caption, where the send glyph has a
 *  44 frame 10 off it. */
const ICON_FRAME_SIZE = { review: 44, sent: 72 } as const
const SENT_ICON_EXTRA_GAP = 10
const SENT_BADGE_SIZE = 49
/** The badge starts drawing while the hero is still on its way to the middle. */
const SENT_BADGE_DELAY_MS = 150

/** The sent amount takes amount entry's scale, so it lands at the size it was typed at. */
const sentPrimaryFontSize = (amount: string): number => entryAmountFontSize(amount, false)

/** How much taller the hero stands once sent, so a caller centring it can allow for the
 *  growth. Every line holds to one, so the growth is exact. */
export const sentHeroGrowth = ({
  primaryAmount,
  hasSecondaryAmount,
}: {
  primaryAmount: string
  hasSecondaryAmount: boolean
}): number =>
  ICON_FRAME_SIZE.sent -
  ICON_FRAME_SIZE.review +
  SENT_ICON_EXTRA_GAP +
  CAPTION_LINE_HEIGHT.sent -
  CAPTION_LINE_HEIGHT.review +
  sentPrimaryFontSize(primaryAmount) +
  ENTRY_LINE_HEIGHT_OFFSET -
  LINE_HEIGHT.inactive.primary +
  (hasSecondaryAmount ? SENT_LINE_HEIGHT.secondary - LINE_HEIGHT.inactive.secondary : 0)

type SendHeroProps = {
  /** The line above the amount: the destination while entering it, what the screen is
   *  doing once it is settled. */
  caption: string
  primaryAmount: string
  secondaryAmount?: string
  /**
   * The sender is still working on the amount: it leads at entry size, and a change of
   * `primaryCurrency` swaps the two lines into place. Inactive is the settled read-out.
   */
  active?: boolean
  /** Identifies which currency leads; a change swaps the two lines. Active only. */
  primaryCurrency?: string
  /** No amount entered yet: both lines are muted until the sender types one. */
  isEmpty?: boolean
  /** Present while the amount is typed on the keypad: swaps which currency the keys enter. */
  onSwapCurrency?: () => void
  /** Long press on the caption, where the caption is a destination worth copying. */
  onCaptionLongPress?: () => void
  /** 0 on review, 1 once sent: grows the lines and turns the icon green. Settled only. */
  sentProgress?: SharedValue<number>
  /** The payment has landed: the sent badge mounts and draws itself in. */
  isSent?: boolean
}

export const SendHero: React.FC<SendHeroProps> = ({
  caption,
  primaryAmount,
  secondaryAmount,
  active = false,
  primaryCurrency,
  isEmpty = false,
  onSwapCurrency,
  onCaptionLongPress,
  sentProgress,
  isSent = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const entryPrimarySize = entryAmountFontSize(primaryAmount, isEmpty)
  const primarySize = active
    ? {
        fontSize: entryPrimarySize,
        lineHeight: entryPrimarySize + ENTRY_LINE_HEIGHT_OFFSET,
      }
    : {
        fontSize: AMOUNT_SIZE.inactive.primary,
        lineHeight: LINE_HEIGHT.inactive.primary,
      }
  /** How far each line's centre travels to reach the other's. */
  const swapDistance = (primarySize.lineHeight + LINE_HEIGHT.active.secondary) / 2
  const sizeRatio = AMOUNT_SIZE.active.secondary / primarySize.fontSize

  const swap = useSharedValue(1)
  const previousPrimaryCurrency = useSharedValue(primaryCurrency)

  useEffect(() => {
    if (previousPrimaryCurrency.value === primaryCurrency) return
    previousPrimaryCurrency.value = primaryCurrency
    swap.value = 0
    swap.value = withTiming(1, {
      duration: SWAP_ANIMATION_MS,
      easing: Easing.inOut(Easing.quad),
    })
  }, [primaryCurrency, swap, previousPrimaryCurrency])

  /** Each line starts where, and at the size, the other one was, then settles in its own. */
  const primaryStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: swapDistance * (1 - swap.value) },
        { scale: 1 - (1 - sizeRatio) * (1 - swap.value) },
      ],
    }),
    [swap, swapDistance, sizeRatio],
  )

  const secondaryStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: -swapDistance * (1 - swap.value) },
        { scale: 1 + (1 / sizeRatio - 1) * (1 - swap.value) },
      ],
    }),
    [swap, swapDistance, sizeRatio],
  )

  const size = active ? "active" : "inactive"

  const noProgress = useSharedValue(0)
  const sent = sentProgress ?? noProgress

  const sentCaptionStyle = useAnimatedStyle(
    () => ({
      fontSize: interpolate(sent.value, [0, 1], [CAPTION_SIZE.review, CAPTION_SIZE.sent]),
      lineHeight: interpolate(
        sent.value,
        [0, 1],
        [CAPTION_LINE_HEIGHT.review, CAPTION_LINE_HEIGHT.sent],
      ),
    }),
    [sent],
  )

  const sentPrimarySize = sentPrimaryFontSize(primaryAmount)
  const sentPrimaryStyle = useAnimatedStyle(
    () => ({
      fontSize: interpolate(
        sent.value,
        [0, 1],
        [AMOUNT_SIZE.inactive.primary, sentPrimarySize],
      ),
      lineHeight: interpolate(
        sent.value,
        [0, 1],
        [LINE_HEIGHT.inactive.primary, sentPrimarySize + ENTRY_LINE_HEIGHT_OFFSET],
      ),
    }),
    [sent, sentPrimarySize],
  )

  const sentSecondaryStyle = useAnimatedStyle(
    () => ({
      fontSize: interpolate(
        sent.value,
        [0, 1],
        [AMOUNT_SIZE.inactive.secondary, SENT_AMOUNT_SIZE.secondary],
      ),
      lineHeight: interpolate(
        sent.value,
        [0, 1],
        [LINE_HEIGHT.inactive.secondary, SENT_LINE_HEIGHT.secondary],
      ),
    }),
    [sent],
  )

  /** The send glyph fades as the frame grows round it, and the badge draws itself in its
   *  place. */
  const sentIconFrameStyle = useAnimatedStyle(() => {
    const frame = interpolate(
      sent.value,
      [0, 1],
      [ICON_FRAME_SIZE.review, ICON_FRAME_SIZE.sent],
    )
    return {
      width: frame,
      height: frame,
      marginBottom: interpolate(sent.value, [0, 1], [0, SENT_ICON_EXTRA_GAP]),
    }
  }, [sent])
  const sendingIconStyle = useAnimatedStyle(() => ({ opacity: 1 - sent.value }), [sent])
  const isMorphing = Boolean(sentProgress) && !active

  const captionNode = (
    <Pressable onLongPress={onCaptionLongPress} disabled={!onCaptionLongPress}>
      <Animated.Text
        numberOfLines={1}
        ellipsizeMode="middle"
        style={[styles.caption, isMorphing && sentCaptionStyle]}
        {...testProps(SEND_HERO_CAPTION_TEST_ID)}
      >
        {caption}
      </Animated.Text>
    </Pressable>
  )

  const amounts = (
    <Pressable
      onPress={onSwapCurrency}
      disabled={!onSwapCurrency || !secondaryAmount}
      accessibilityRole={onSwapCurrency ? "button" : undefined}
    >
      <Animated.Text
        style={[
          styles.amount,
          {
            ...primarySize,
            color: isEmpty ? colors.grey2 : colors.black,
          },
          active && primaryStyle,
          isMorphing && sentPrimaryStyle,
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
        {...testProps(SEND_HERO_PRIMARY_TEST_ID)}
      >
        {primaryAmount}
      </Animated.Text>
      {secondaryAmount ? (
        <Animated.Text
          style={[
            styles.amount,
            {
              fontSize: AMOUNT_SIZE[size].secondary,
              lineHeight: LINE_HEIGHT[size].secondary,
              color: isEmpty ? colors.grey3 : active ? colors.grey2 : colors.black,
            },
            !active && styles.settledSecondary,
            active && secondaryStyle,
            isMorphing && sentSecondaryStyle,
          ]}
          numberOfLines={1}
          {...testProps(SEND_HERO_SECONDARY_TEST_ID)}
        >
          {secondaryAmount}
        </Animated.Text>
      ) : null}
    </Pressable>
  )

  const icon = isMorphing ? (
    <View style={styles.iconStack}>
      <Animated.View style={sendingIconStyle}>
        <GaloyIcon name="send" size={ICON_SIZE} color={colors.primary} />
      </Animated.View>
      {isSent ? (
        <View style={styles.badgeOverlay}>
          <SuccessBadge size={SENT_BADGE_SIZE} delay={SENT_BADGE_DELAY_MS} />
        </View>
      ) : null}
    </View>
  ) : (
    "send"
  )

  return (
    <IconHero
      icon={icon}
      iconColor={colors.primary}
      iconSize={ICON_SIZE}
      hasIconBackground={false}
      compact
      iconFrameStyle={isMorphing ? sentIconFrameStyle : undefined}
      caption={captionNode}
      title={amounts}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  caption: {
    fontFamily: fonts.regular,
    fontSize: CAPTION_SIZE.review,
    lineHeight: CAPTION_LINE_HEIGHT.review,
    textAlign: "center",
    color: colors.black,
  },
  iconStack: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  /** Centred on the glyph's box, which the badge outgrows. */
  badgeOverlay: {
    position: "absolute",
    top: (ICON_SIZE - SENT_BADGE_SIZE) / 2,
    left: (ICON_SIZE - SENT_BADGE_SIZE) / 2,
  },
  amount: {
    fontFamily: fonts.bold,
    textAlign: "center",
  },
  /** A settled secondary reads as part of the amount rather than as a hint under it. */
  settledSecondary: {
    fontFamily: fonts.regular,
  },
}))
