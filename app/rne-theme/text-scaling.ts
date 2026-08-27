import { PixelRatio, Platform } from "react-native"

/**
 * How far text may follow the OS text-size setting. Blink has no text-size control of its
 * own, so every screen inherits the system font scale directly, and past this point the
 * layouts stop merely growing: fixed-height rows clip, labels truncate to two characters,
 * and pills crowd out the amounts beside them.
 *
 * The theme applies it to every themed `Text`, so a new screen inherits the ceiling instead
 * of having to remember it, and a component that needs a different one passes its own
 * `maxFontSizeMultiplier`, which wins: the theme's props are merged UNDER a component's.
 * Components built on React Native's own `Text` are outside that reach and pass it here.
 *
 * It sits apart from the theme it feeds so that reading the ceiling never means building
 * the theme: components that only need the number would otherwise pull the whole thing in.
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.4

/**
 * How far a box that holds text has to grow to keep holding it: the OS scale, capped the
 * same way the text inside it is. A width or height measured for the default size stops
 * fitting the moment the glyphs grow, and the text breaks mid-word or clips rather than the
 * box giving way. Multiply the fixed measurement by this and it keeps the proportions it
 * was drawn with, at every OS setting.
 */
export const cappedFontScale = (): number =>
  Math.min(PixelRatio.getFontScale(), MAX_FONT_SIZE_MULTIPLIER)

/**
 * A line height that stops where the text does. Android scales an explicit `lineHeight` by
 * the OS font scale but never applies the ceiling the font itself respects, so past the
 * ceiling the glyphs hold still while the line box keeps growing and the text floats in a
 * row twice its height. Dividing it back leaves the box at `lineHeight * min(scale,
 * ceiling)`. iOS clamps both already, so it is handed back untouched.
 */
export const cappedLineHeight = (lineHeight: number): number =>
  Platform.OS === "android"
    ? (lineHeight * cappedFontScale()) / PixelRatio.getFontScale()
    : lineHeight
