import React from "react"
import Svg, { Path } from "react-native-svg"

import { useTheme } from "@rn-vui/themed"

// BTC Map's marker silhouette, taken from the sprite generator its web map uses,
// so the pin reads as the same shape as the one on btcmap.org. The fill does not
// follow btcmap.org: it follows the app's own palette, which restyles for dark
// mode where btcmap.org's single teal does not.
const PIN_PATH =
  "M0 16.0333C0 6.08 8.05161 0.131836 15.8361 0.131836C23.6205 0.131836 31.6721 6.08 " +
  "31.6721 16.0333C31.6721 26.461 16.9494 41.3035 16.3229 41.9301C16.1941 42.0595 " +
  "16.0185 42.1318 15.8361 42.1318C15.6536 42.1318 15.478 42.0595 15.3493 41.9301C14.7227 " +
  "41.3035 0 26.461 0 16.0333Z"

export const PIN_WIDTH = 32
export const PIN_HEIGHT = 43

// Where the 20×20 category glyph sits inside the pin's head.
export const PIN_GLYPH_SIZE = 20
export const PIN_GLYPH_LEFT = 6
export const PIN_GLYPH_TOP = 5.75

// Dark mode cannot use the theme's primary — it lightens to amber there and
// competes with the boosted pin — so it gets its own periwinkle.
export const PIN_COLOR_DARK = "#8D9EDD"
export const PIN_COLOR_BOOSTED = "#F7931A"

/** The fill for a pin, which is the app's accent rather than btcmap.org's teal. */
export const usePinColor = (isBoostedPlace: boolean): string => {
  const { theme } = useTheme()

  if (isBoostedPlace) return PIN_COLOR_BOOSTED
  return theme.mode === "dark" ? PIN_COLOR_DARK : theme.colors.primary
}

/**
 * The category glyph on a pin: pinned white, not the theme's `white`.
 *
 * Every fill `usePinColor` can return is a saturated accent — two of them fixed
 * past the theme entirely — so the glyph must not invert with the mode. The
 * theme's `white` is the background token and turns black in dark mode, which
 * would hollow the glyph out of the periwinkle pin.
 */
export const usePinGlyphColor = (): string => {
  const { theme } = useTheme()

  return theme.colors._white
}

// The white ring a new place's pin wears outside its fill. Drawn outside rather
// than over the fill's edge, so the teardrop keeps its full size inside it.
const OUTLINE_WIDTH = 2

/** The outlined pin's box: the plain pin grown by the ring on every side. */
export const OUTLINED_PIN_WIDTH = PIN_WIDTH + OUTLINE_WIDTH * 2
export const OUTLINED_PIN_HEIGHT = PIN_HEIGHT + OUTLINE_WIDTH * 2

/**
 * How far down the outlined pin's box its point is: where the plain pin's
 * bottom edge would be, below the ring's width at the top.
 */
export const OUTLINED_PIN_TIP_Y = PIN_HEIGHT + OUTLINE_WIDTH

/** Where the outlined pin's point is, for a marker hung from it. */
export const OUTLINED_PIN_ANCHOR = {
  x: 0.5,
  y: OUTLINED_PIN_TIP_Y / OUTLINED_PIN_HEIGHT,
}

type PinShapeProps = {
  color: string
  /**
   * A ring of this colour drawn outside the fill. The pin then takes
   * `OUTLINED_PIN_WIDTH` × `OUTLINED_PIN_HEIGHT` rather than its plain size.
   */
  outlineColor?: string
}

export const PinShape: React.FC<PinShapeProps> = ({ color, outlineColor }) => {
  if (!outlineColor) {
    return (
      <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="0 0 32 43">
        <Path d={PIN_PATH} fill={color} />
      </Svg>
    )
  }

  // A stroke is centred on the path, so the ring is a stroke twice its width
  // drawn under the fill: the inner half is covered and the outer half is the
  // ring. Round joins keep it the same width around the tip.
  return (
    <Svg
      width={OUTLINED_PIN_WIDTH}
      height={OUTLINED_PIN_HEIGHT}
      viewBox={`${-OUTLINE_WIDTH} ${-OUTLINE_WIDTH} ${OUTLINED_PIN_WIDTH} ${OUTLINED_PIN_HEIGHT}`}
    >
      <Path
        d={PIN_PATH}
        fill={outlineColor}
        stroke={outlineColor}
        strokeWidth={OUTLINE_WIDTH * 2}
        strokeLinejoin="round"
      />
      <Path d={PIN_PATH} fill={color} />
    </Svg>
  )
}

/**
 * The pin for a place that is not on the map yet: the one being aimed, and the
 * one Continue fixes in place.
 *
 * Blue with a white ring rather than the accent every listed place wears, so it
 * cannot be mistaken for one of them. Both colours are the static ones, not
 * theme-relative: the theme's `blue5` turns near-white in dark mode and its
 * `white` turns black, and either would lose the pin against the map.
 */
export const useNewPlacePinColors = (): { color: string; outlineColor: string } => {
  const { theme } = useTheme()

  return { color: theme.colors._blue, outlineColor: theme.colors._white }
}

export const NewPlacePinShape: React.FC = () => {
  const { color, outlineColor } = useNewPlacePinColors()

  return <PinShape color={color} outlineColor={outlineColor} />
}
