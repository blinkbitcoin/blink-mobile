import * as React from "react"
// RN's Text, not the themed one: only the plain component honours
// maxFontSizeMultiplier, and capping the scale is the point of this badge.
import { Animated, Pressable, Text } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { useDropInOutAnimation } from "@app/components/animations"
import { GaloyIcon, type IconNamesType } from "@app/components/atomic/galoy-icon"

/** Exported: whoever arbitrates the badge slot must keep a badge mounted for
 *  exactly `durationOut` after it hides, or its exit animation is cut off. */
export const AMOUNT_BADGE_ANIMATION = {
  delay: 300,
  distance: 15,
  durationIn: 180,
  durationOut: 180,
} as const

/** The badge sits in a fixed-height slot between the balance and the wallet
 *  cards; uncapped Dynamic Type overruns it (#4120). Same ceiling as the
 *  balance above it. */
const MAX_BADGE_FONT_SIZE_MULTIPLIER = 1.4

/** Matches chain.svg's native 18x18 viewBox. */
const ICON_SIZE = 18

export type AmountBadgeVariant = "incoming" | "outgoing" | "pending"

type Props = {
  amountText: string
  variant: AmountBadgeVariant
  visible?: boolean
  onPress?: () => void
  iconName?: IconNamesType
  accessibilityLabel?: string
  testID?: string
}

/**
 * The amount line under the home balance. Two tenants share it: the transient
 * unseen-transaction badge and the persistent pending-deposit row, which differ
 * only in colour, icon and lifecycle — the look, animation and font handling
 * live here so they cannot drift apart in the same slot.
 */
export const AmountBadge: React.FC<Props> = ({
  amountText,
  variant,
  visible = true,
  onPress,
  iconName,
  accessibilityLabel,
  testID,
}) => {
  const styles = useStyles({ variant })
  const { opacity, translateY } = useDropInOutAnimation({
    visible,
    delay: AMOUNT_BADGE_ANIMATION.delay,
    distance: AMOUNT_BADGE_ANIMATION.distance,
    durationIn: AMOUNT_BADGE_ANIMATION.durationIn,
    durationOut: AMOUNT_BADGE_ANIMATION.durationOut,
  })

  const [shouldRender, setShouldRender] = React.useState(visible)

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true)
      return
    }

    const timeout = setTimeout(() => {
      setShouldRender(false)
    }, AMOUNT_BADGE_ANIMATION.durationOut)

    return () => clearTimeout(timeout)
  }, [visible])

  const isPressable = Boolean(onPress)
  const isPressDisabled = !visible || !isPressable
  const pressRole = isPressable ? "button" : "text"
  const accessibilityImportance = visible ? "auto" : "no-hide-descendants"

  return (
    <Pressable
      accessibilityRole={pressRole}
      accessibilityLabel={accessibilityLabel ?? amountText}
      disabled={isPressDisabled}
      onPress={onPress}
      style={styles.touch}
      testID={testID}
    >
      <Animated.View
        key={amountText}
        style={[styles.badge, { opacity, transform: [{ translateY }] }]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={accessibilityImportance}
      >
        {shouldRender ? (
          <>
            {iconName ? (
              <GaloyIcon name={iconName} size={ICON_SIZE} color={styles.text.color} />
            ) : null}
            <Text
              style={styles.text}
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={MAX_BADGE_FONT_SIZE_MULTIPLIER}
            >
              {amountText}
            </Text>
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(
  ({ colors }, { variant }: { variant: AmountBadgeVariant }) => ({
    touch: {
      alignSelf: "center",
      maxWidth: "100%",
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 6,
      borderRadius: 8,
      paddingHorizontal: 20,
      alignSelf: "center",
    },
    text: {
      fontSize: 20,
      flexShrink: 1,
      color: variant === "incoming" ? colors._green : colors.grey2,
    },
  }),
)
