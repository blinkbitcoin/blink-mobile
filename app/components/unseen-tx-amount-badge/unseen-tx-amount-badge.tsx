import * as React from "react"
import { Animated, Pressable } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"

import { useDropInAnimation } from "@app/components/animations"

const UNSEEN_BADGE_ANIMATION = {
  delay: 300,
  distance: 15,
  durationIn: 180,
}
const HIDDEN_STYLE = {
  opacity: 0,
  transform: [{ translateY: 0 }],
}

type UnseenTxAmountBadgeProps = {
  amountText: string
  visible?: boolean
  onPress?: () => void
  isOutgoing?: boolean
}

export const UnseenTxAmountBadge: React.FC<UnseenTxAmountBadgeProps> = ({
  amountText,
  visible = true,
  onPress,
  isOutgoing,
}) => {
  const styles = useStyles({ isOutgoing })
  const { opacity, translateY } = useDropInAnimation({
    visible,
    delay: UNSEEN_BADGE_ANIMATION.delay,
    distance: UNSEEN_BADGE_ANIMATION.distance,
    durationIn: UNSEEN_BADGE_ANIMATION.durationIn,
  })

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
        style={[
          styles.badge,
          visible ? { opacity, transform: [{ translateY }] } : HIDDEN_STYLE,
        ]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      >
        {visible ? <Text style={styles.text}>{amountText}</Text> : null}
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
