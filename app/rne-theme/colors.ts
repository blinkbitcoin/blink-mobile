// Design tokens are named by purpose, not appearance.
// The semantic palettes below are the single source of truth for every color value.
// The legacy names at the bottom are deprecated aliases that reference the semantic
// values — they exist only so old code keeps working during the migration, and must
// not be used in new code (enforced by eslint no-restricted-syntax).

// `static*` tokens never invert between light and dark mode. They are only for
// screens that require no inversion (QR code, camera) or sections that are not
// dark/light aware (earns). Usage outside the eslint allowlist is an error.

const lightStatic = {
  staticWhite: "#FFFFFF",
  staticBlack: "#000000",
  staticLightGrey: "#CFD9E2",
  staticLighterGrey: "#E6EBEf",
  staticDarkGrey: "#1d1d1d",
  staticCardPill: "#393939",
  staticCardBackground: "#FF6418",
  staticBrandOrange: "#FF7e1c",
  staticSuccess: "#00A700",
  staticBrandYellow: "#FFBE0B",
  staticBrandSunset: "#FB5607",
  staticWarningBackground: "#FFF9E5",
  staticBlue: "#3050C4",
  staticBrightBlue: "#3553FF",
  staticPaleBlue: "#C3CCFF",
}

// static tokens are identical in both modes by definition
const darkStatic = lightStatic

// Dims the screen behind a modal or sheet. Black in both modes: the backdrop tokens
// invert and would brighten the screen in dark mode.
const scrim = "rgba(0, 0, 0, 0.5)"

const lightSemantic = {
  ...lightStatic,

  transparent: "rgba(0, 0, 0, 0)",

  backgroundDefault: "#FFFFFF",
  textOnBackground: "#000000",

  textPrimary: "#3A3C51",
  textSecondary: "#393939",
  textMuted: "#8C8C97", // 3.33:1 on backgroundDefault — secondary labels only
  textDisabled: "#AEAEB8",

  neutral: "#E2E2E4",

  // Field fills darkened by design ruling (Nov 2026) to improve contrast
  // against backgroundDefault; surfaceStatic stays lighter than surfaceInteractive.
  surfaceInteractive: "#ECECEE", // tappable surface, at rest
  // Darkened with surfaceInteractive (design ruling, Nov 2026) to keep the old
  // #F2F2F4 → #E7E7E7 step of 1.1:1. Pressed and focused fills share it.
  surfacePressed: "#E1E1E3", // surfaceInteractive while held — transient only
  surfaceStatic: "#F2F2F2", // cannot be tapped, ever — cards, banners, read-only

  accent: "#fc5805",

  error: "#DC2626",
  errorBackground: "#FEE2E2",

  warning: "#E18E02",

  loaderForeground: "#ecebeb",
  loaderBackground: "#f3f3f3",

  backdrop: "rgba(0, 0, 0, 0.06)",
  backdropStrong: "rgba(0, 0, 0, 0.12)",

  scrim,
}

const darkSemantic = {
  ...darkStatic,

  transparent: "rgba(0, 0, 0, 0)",

  backgroundDefault: "#000000",
  textOnBackground: "#FFFFFF",

  textPrimary: "#FAF9F9",
  textSecondary: "#E9E8E8",
  textMuted: "#CCCCCC",
  textDisabled: "#949494",

  neutral: "#393939",

  surfaceInteractive: "#1d1d1d",
  surfacePressed: "#2B2B2B",
  surfaceStatic: "#171717", // lightened by design ruling to improve contrast

  accent: "#ffad0d",

  error: "#DC2626",
  errorBackground: "#7F1D1D",

  warning: "#FFC563",

  loaderForeground: "#3c3b3b",
  loaderBackground: "#131313",

  backdrop: "rgba(255, 255, 255, 0.06)",
  backdropStrong: "rgba(255, 255, 255, 0.12)",

  scrim,
}

// Deprecated legacy aliases. Every value is a reference into the semantic palette,
// so the two name sets can never drift apart. Do not add new usages.
const legacyAliases = (semantic: typeof lightSemantic | typeof darkSemantic) => ({
  // appearance-named tokens that lied in dark mode
  white: semantic.backgroundDefault,
  black: semantic.textOnBackground,

  primary: semantic.accent,

  grey0: semantic.textPrimary,
  grey1: semantic.textSecondary,
  grey2: semantic.textMuted,
  grey3: semantic.textDisabled,
  grey4: semantic.neutral,
  grey5: semantic.surfaceInteractive,
  grey6: semantic.surfacePressed,
  grey7: semantic.surfaceStatic,

  red: semantic.error,
  error9: semantic.errorBackground,

  backdropWhite: semantic.backdrop,
  backdropWhiter: semantic.backdropStrong,

  // static tokens previously prefixed with `_`
  _white: semantic.staticWhite,
  _black: semantic.staticBlack,
  _lightGrey: semantic.staticLightGrey,
  _lighterGrey: semantic.staticLighterGrey,
  _darkGrey: semantic.staticDarkGrey,
  _cardPill: semantic.staticCardPill,
  _orange: semantic.staticBrandOrange,
  _green: semantic.staticSuccess,
  _primary1: semantic.staticBrandYellow,
  _primary2: semantic.staticBrandSunset,
  _warningLight: semantic.staticWarningBackground,

  // the app blues; none of them is the brand blue
  _blue: semantic.staticBlue,
  _lightBlue: semantic.staticBrightBlue,
  _sky: semantic.staticPaleBlue,
})

// Role tokens that share a value with another token today but do a different job.
// They reference that token instead of repeating its value, and get their own value
// once design separates them (e.g. textOnAccent turning black for AA contrast).
const roleTokens = (semantic: typeof lightSemantic | typeof darkSemantic) => ({
  textOnAccent: semantic.backgroundDefault, // labels and icons on an accent fill
  textOnAccentDisabled: semantic.surfaceInteractive, // label on a disabled accent fill
  textPlaceholder: semantic.neutral,
  borderStrong: semantic.textDisabled, // focused input underline
  surfaceInactive: semantic.textDisabled, // unselected currency pill and bubble
  surfaceFocused: semantic.surfacePressed, // input field fill while focused
  // Brand success green. Overrides the UI library default (#52C41A) that
  // `colors.success` fell back to, since the palette never defined it.
  success: semantic.staticSuccess,
})

// Flagged for design review: still the info box tint, with no semantic name yet.
const legacyBlue5 = {
  light: { blue5: "#4453E2" },
  dark: { blue5: "#F0F0F7" },
}

const light = {
  ...lightSemantic,
  ...roleTokens(lightSemantic),
  ...legacyAliases(lightSemantic),
  ...legacyBlue5.light,
}

const dark = {
  ...darkSemantic,
  ...roleTokens(darkSemantic),
  ...legacyAliases(darkSemantic),
  ...legacyBlue5.dark,
}

export { light, dark }
