import "@rn-vui/themed"

declare module "@rn-vui/themed" {
  export interface Colors {
    red: string
    transparent: string

    // _ are meant to be static across light and dark
    // either because they are used in screen that require no inversion
    // like for the QR code, or camera view
    // or because they are used in the earn section which is not dark/light mode aware

    _white: string
    _black: string
    _lightGrey: string
    _lighterGrey: string
    _lightBlue: string
    _darkGrey: string
    _blue: string
    _orange: string
    _sky: string
    _green: string

    primary3: string
    primary4: string
    primary5: string
    error9: string

    blue5: string

    grey6: string

    loaderForeground: string
    loaderBackground: string

    backdropWhite: string
    backdropWhiter: string
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
