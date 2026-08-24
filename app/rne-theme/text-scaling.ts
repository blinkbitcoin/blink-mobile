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
