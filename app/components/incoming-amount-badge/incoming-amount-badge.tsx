import * as React from "react"
import { Animated, Pressable } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"

import { useDropInAnimation } from "@app/components/animations"

const INCOMING_BADGE_ANIMATION = {
  delay: 300,
  distance: 15,
  durationIn: 180,
}
const HIDDEN_STYLE = {
  opacity: 0,
  transform: [{ translateY: 0 }],
}

type IncomingBadgeProps = {
  text: string
  visible?: boolean
  onPress?: () => void
  outgoing?: boolean
}

export const IncomingAmountBadge: React.FC<IncomingBadgeProps> = ({
  text,
  visible = true,
  onPress,
  outgoing,
}) => {
  const styles = useStyles({ outgoing })
  const { opacity, translateY } = useDropInAnimation({
    visible,
    delay: INCOMING_BADGE_ANIMATION.delay,
    distance: INCOMING_BADGE_ANIMATION.distance,
    durationIn: INCOMING_BADGE_ANIMATION.durationIn,
  })

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      disabled={!visible}
      onPress={onPress}
      style={styles.touch}
    >
      <Animated.View
        style={[
          styles.badge,
          visible ? { opacity, transform: [{ translateY }] } : HIDDEN_STYLE,
        ]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      >
        {visible ? <Text style={styles.text}>{text}</Text> : null}
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }, { outgoing }: { outgoing?: boolean }) => ({
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
    color: outgoing ? colors.grey2 : colors._green,
  },
}))
