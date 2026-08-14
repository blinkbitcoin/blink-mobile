import React from "react"
import Svg, { Path } from "react-native-svg"

// BTC Map's marker silhouette and colours, taken from the sprite generator its
// web map uses, so a pin here reads as the same pin on btcmap.org. Both themes
// share them — only the surrounding map restyles for dark mode.
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

export const PIN_COLOR = "#0E95AF"
export const PIN_COLOR_BOOSTED = "#F7931A"
export const PIN_GLYPH_COLOR = "#FFFFFF"

export const PinShape: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="0 0 32 43">
    <Path d={PIN_PATH} fill={color} />
  </Svg>
)
