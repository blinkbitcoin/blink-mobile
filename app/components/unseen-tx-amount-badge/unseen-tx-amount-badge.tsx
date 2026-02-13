import * as React from "react"
import { Animated, Pressable } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"

import { useDropInOutAnimation } from "@app/components/animations"

const UNSEEN_BADGE_ANIMATION = {
  delay: 300,
  distance: 15,
  durationIn: 180,
  durationOut: 180,
}

type UnseenTxAmountBadgeProps = {
  amountText: string
  visible?: boolean
  onPress?: () => void
  isOutgoing?: boolean
  onExitComplete?: () => void
}

export const UnseenTxAmountBadge: React.FC<UnseenTxAmountBadgeProps> = ({
  amountText,
  visible = true,
  onPress,
  isOutgoing,
  onExitComplete,
}) => {
  const styles = useStyles({ isOutgoing })
  const { opacity, translateY } = useDropInOutAnimation({
    visible,
    delay: UNSEEN_BADGE_ANIMATION.delay,
    distance: UNSEEN_BADGE_ANIMATION.distance,
    durationIn: UNSEEN_BADGE_ANIMATION.durationIn,
    durationOut: UNSEEN_BADGE_ANIMATION.durationOut,
    reverseExit: !isOutgoing,
    onExitComplete,
  })

  const [shouldRender, setShouldRender] = React.useState(visible)

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true)
      return
    }

    const timeout = setTimeout(() => {
      setShouldRender(false)
    }, UNSEEN_BADGE_ANIMATION.durationOut)

    return () => clearTimeout(timeout)
  }, [visible])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={amountText}
      disabled={!visible}
      onPress={onPress}
      style={styles.touch}
    >
      <Animated.View
        key={amountText}
        style={[styles.badge, { opacity, transform: [{ translateY }] }]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      >
        {shouldRender ? <Text style={styles.text}>{amountText}</Text> : null}
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }, { isOutgoing }: { isOutgoing?: boolean }) => ({
  touch: {
    alignSelf: "center",
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 20,
    alignSelf: "center",
  },
  text: {
    fontSize: 20,
    color: isOutgoing ? colors.grey2 : colors._green,
  },
}))
