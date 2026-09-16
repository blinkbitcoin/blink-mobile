import React, { useEffect } from "react"
import { Pressable } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconHero } from "@app/components/icon-hero"
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
 * While the amount is typed it starts large and steps down evenly with each digit, so a long
 * amount still fits on one line: 36 for an empty or one-digit amount, 22 from ten digits
 * (1,000,000,000) on.
 */
const ENTRY_AMOUNT_SIZE = { max: 36, min: 22 } as const
const ENTRY_AMOUNT_MIN_SIZE_DIGITS = 10
const ENTRY_LINE_HEIGHT_OFFSET = 2

export const entryAmountFontSize = (amount: string, isEmpty: boolean): number => {
  if (isEmpty) return ENTRY_AMOUNT_SIZE.max
  const digits = amount.replace(/\D/g, "").length
  const progress = Math.min(
    Math.max(digits - 1, 0) / (ENTRY_AMOUNT_MIN_SIZE_DIGITS - 1),
    1,
  )
  return Math.round(
    ENTRY_AMOUNT_SIZE.max - (ENTRY_AMOUNT_SIZE.max - ENTRY_AMOUNT_SIZE.min) * progress,
  )
}

const SWAP_ANIMATION_MS = 220

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

  const captionNode = (
    <Pressable onLongPress={onCaptionLongPress} disabled={!onCaptionLongPress}>
      <Text
        type="p4"
        numberOfLines={1}
        ellipsizeMode="middle"
        style={styles.caption}
        {...testProps(SEND_HERO_CAPTION_TEST_ID)}
      >
        {caption}
      </Text>
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
          ]}
          numberOfLines={1}
          {...testProps(SEND_HERO_SECONDARY_TEST_ID)}
        >
          {secondaryAmount}
        </Animated.Text>
      ) : null}
    </Pressable>
  )

  return (
    <IconHero
      icon="send"
      iconColor={colors.primary}
      iconSize={ICON_SIZE}
      hasIconBackground={false}
      compact
      caption={captionNode}
      title={amounts}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  caption: {
    textAlign: "center",
    color: colors.black,
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
