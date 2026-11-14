import React, { useState } from "react"
import { StyleSheet, View } from "react-native"
import { CannonConfetti, ReduceMotionConfig } from "react-native-fast-confetti"
import { Colors, useTheme } from "@rn-vui/themed"

/** Most pieces leave through the sides early, so enough are thrown to keep the fall dense. */
const DEFAULT_COUNT = 150
/** Tuned with the gravity: changing only one of them changes how high the burst climbs. */
const DEFAULT_SPEED = 1.9
/** Below the library's 3, so the pieces float down and the burst lasts about 3 s. */
const DEFAULT_GRAVITY = 1.2
/** A wide cone, so the burst fans out over the bottom of the screen like the design. */
const SPREAD = Math.PI / 1.6
/** Off entirely when the system asks to reduce motion, not just scaled down. */
const REDUCE_MOTION: ReduceMotionConfig = { mode: "system", factor: 1 }

export type ConfettiProps = {
  /** How many pieces the burst throws. */
  count?: number
  /** How hard the burst throws them: higher climbs further up the screen. */
  speed?: number
  /** How fast the pieces fall back: lower floats longer. */
  gravity?: number
  /** The piece colors. Defaults to the theme's celebration colors. */
  colors?: readonly string[]
}

const celebrationPalette = (colors: Colors): string[] => [
  colors.success,
  colors.accent,
  colors.staticBrandOrange,
  colors.error,
  colors.staticBlue,
  colors.staticPaleBlue,
]

/** A one-shot burst shooting up from the bottom of the screen, drawn by
 *  react-native-fast-confetti. It never takes a touch, and it unmounts once the burst
 *  ends so its canvas does not linger. */
export const Confetti: React.FC<ConfettiProps> = ({
  count = DEFAULT_COUNT,
  speed = DEFAULT_SPEED,
  gravity = DEFAULT_GRAVITY,
  colors: palette,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const [isPlaying, setIsPlaying] = useState(true)
  /** Read once per mount: a palette passed inline must not restart the burst. */
  const [pieceColors] = useState(() => [...(palette ?? celebrationPalette(colors))])

  if (!isPlaying) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="confetti">
      <CannonConfetti
        autoplay
        fadeOutOnEnd
        gravity={gravity}
        colors={pieceColors}
        reduceMotion={REDUCE_MOTION}
        onAnimationEnd={() => setIsPlaying(false)}
      >
        <CannonConfetti.Origin
          position="bottom-center"
          count={count}
          initialSpeed={speed}
          spread={SPREAD}
        >
          <CannonConfetti.Flake width={8} height={14} radius={2} />
          <CannonConfetti.Flake width={4} height={16} radius={2} />
          <CannonConfetti.Flake size={8} radius={2} />
        </CannonConfetti.Origin>
      </CannonConfetti>
    </View>
  )
}
