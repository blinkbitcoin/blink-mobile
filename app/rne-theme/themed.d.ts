import "@rn-vui/themed"

declare module "@rn-vui/themed" {
  export interface Colors {
    // Semantic tokens — named by purpose, not appearance.
    // Use only these (plus loader*/warning/error/transparent) in new code.
    backgroundDefault: string
    textOnBackground: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    textDisabled: string
    border: string
    surfaceInteractive: string
    surfacePressed: string
    surfaceStatic: string
    accent: string
    accent2: string
    accent3: string
    accent4: string
    errorBackground: string
    backdrop: string
    backdropStrong: string

    // static* tokens never invert between light and dark mode.
    // Allowed only on screens that require no inversion (QR code, camera)
    // or in sections that are not dark/light aware (earns) — eslint-enforced.
    staticWhite: string
    staticBlack: string
    staticLightGrey: string
    staticLighterGrey: string
    staticDarkGrey: string
    staticCardPill: string
    staticBrandOrange: string
    staticSuccess: string
    staticBrandYellow: string
    staticBrandSunset: string
    staticWarningBackground: string

    loaderForeground: string
    loaderBackground: string

    // Deprecated legacy aliases — kept working during the migration, do not use.

    /** @deprecated use backgroundDefault */
    readonly white: string
    /** @deprecated use textOnBackground */
    readonly black: string
    /** @deprecated use accent */
    readonly primary: string
    /** @deprecated use accent2 */
    primary3: string
    /** @deprecated use accent3 */
    primary4: string
    /** @deprecated use accent4 */
    primary5: string
    /** @deprecated use textPrimary */
    readonly grey0: string
    /** @deprecated use textSecondary */
    readonly grey1: string
    /** @deprecated use textMuted */
    readonly grey2: string
    /** @deprecated use textDisabled */
    readonly grey3: string
    /** @deprecated use border */
    readonly grey4: string
    /** @deprecated use surfaceInteractive */
    readonly grey5: string
    /** @deprecated use surfacePressed */
    grey6: string
    /** @deprecated use surfaceStatic */
    grey7: string
    /** @deprecated use error */
    red: string
    /** @deprecated use errorBackground */
    error9: string
    /** @deprecated use backdrop */
    backdropWhite: string
    /** @deprecated use backdropStrong */
    backdropWhiter: string

    /** @deprecated flagged for design review — not the brand blue, do not use */
    blue5: string

    /** @deprecated use staticWhite */
    _white: string
    /** @deprecated use staticBlack */
    _black: string
    /** @deprecated use staticLightGrey */
    _lightGrey: string
    /** @deprecated use staticLighterGrey */
    _lighterGrey: string
    /** @deprecated use staticDarkGrey */
    _darkGrey: string
    /** @deprecated use staticCardPill */
    _cardPill: string
    /** @deprecated use staticBrandOrange */
    _orange: string
    /** @deprecated use staticSuccess */
    _green: string
    /** @deprecated use staticBrandYellow */
    _primary1: string
    /** @deprecated use staticBrandSunset */
    _primary2: string
    /** @deprecated use staticWarningBackground */
    _warningLight: string

    /** @deprecated flagged for design review — not the brand blue, do not use */
    _blue: string
    /** @deprecated flagged for design review — not the brand blue, do not use */
    _lightBlue: string
    /** @deprecated flagged for design review — not the brand blue, do not use */
    _sky: string

    transparent: string
  }

  export interface TextProps {
    bold?: boolean
    type?: "p1" | "p2" | "p3" | "p4" | "h1" | "h2"
    color?: string
  }

  export interface ComponentTheme {
    Text: Partial<TextProps>
  }
}
