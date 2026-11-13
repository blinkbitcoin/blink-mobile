import fs from "fs"
import path from "path"

import { light, dark } from "../colors"

// During the token migration (see app/rne-theme/colors.ts), every legacy color
// name is a deprecated alias of a semantic token. These tests guarantee the two
// name sets can never drift apart while both exist.

const aliasToSemantic: Record<string, string> = {
  white: "backgroundDefault",
  black: "textOnBackground",
  primary: "accent",
  grey0: "textPrimary",
  grey1: "textSecondary",
  grey2: "textMuted",
  grey3: "textDisabled",
  grey4: "neutral",
  grey5: "surfaceInteractive",
  grey6: "surfacePressed",
  grey7: "surfaceStatic",
  red: "error",
  error9: "errorBackground",
  backdropWhite: "backdrop",
  backdropWhiter: "backdropStrong",
  _white: "staticWhite",
  _black: "staticBlack",
  _lightGrey: "staticLightGrey",
  _lighterGrey: "staticLighterGrey",
  _darkGrey: "staticDarkGrey",
  _cardPill: "staticCardPill",
  _orange: "staticBrandOrange",
  _green: "staticSuccess",
  _primary1: "staticBrandYellow",
  _primary2: "staticBrandSunset",
  _warningLight: "staticWarningBackground",
  _blue: "staticBlue",
  _lightBlue: "staticBrightBlue",
  _sky: "staticPaleBlue",
}

// Role tokens share their source token's value until design gives them their own.
// Drop an entry here in the same change that gives that role a value of its own.
const roleToSource: Record<string, string> = {
  textOnAccent: "backgroundDefault",
  textOnAccentDisabled: "surfaceInteractive",
  textPlaceholder: "neutral",
  borderStrong: "textDisabled",
  surfaceInactive: "textDisabled",
  surfaceFocused: "surfacePressed",
  success: "staticSuccess",
}

describe("color token aliases", () => {
  const checkAliases = (palette: Record<string, string>) => {
    for (const [legacy, semantic] of Object.entries({
      ...aliasToSemantic,
      ...roleToSource,
    })) {
      expect(palette[legacy]).toBeDefined()
      expect(palette[semantic]).toBeDefined()
      expect(palette[legacy]).toEqual(palette[semantic])
    }
  }

  it("every legacy alias and role token matches its source in light mode", () => {
    checkAliases(light as unknown as Record<string, string>)
  })

  it("every legacy alias and role token matches its source in dark mode", () => {
    checkAliases(dark as unknown as Record<string, string>)
  })

  // darkStatic is lightStatic today, so this only bites if someone splits the two.
  it("static tokens are identical across modes", () => {
    for (const [key, value] of Object.entries(light)) {
      if (key.startsWith("static")) {
        expect(dark[key as keyof typeof dark]).toEqual(value)
      }
    }
  })

  it("keeps light and dark key sets identical", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })
})

// Field fills ruled by design (Nov 2026) for contrast against backgroundDefault.
// The alias tests above only check names against each other, so pin the values.
describe("field fill values", () => {
  it("uses the ruled field fills in light mode", () => {
    expect(light.surfaceInteractive).toBe("#ECECEE")
    expect(light.surfacePressed).toBe("#E1E1E3")
    expect(light.surfaceStatic).toBe("#F2F2F2")
  })

  it("uses the ruled field fills in dark mode", () => {
    expect(dark.surfaceInteractive.toUpperCase()).toBe("#1D1D1D")
    expect(dark.surfacePressed).toBe("#2B2B2B")
    expect(dark.surfaceStatic).toBe("#171717")
  })

  // Design ruling (Nov 2026): the pressed and focused fill keeps the step it had
  // over the resting fill before surfaceInteractive darkened (#F2F2F4 → #E7E7E7).
  it("keeps the pressed fill at least 1.1:1 from the resting fill", () => {
    const channel = (hex: string, i: number) => {
      const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminance = (hex: string) =>
      0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2)
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }

    expect(
      contrast(light.surfaceInteractive, light.surfacePressed),
    ).toBeGreaterThanOrEqual(1.1)
    expect(contrast(dark.surfaceInteractive, dark.surfacePressed)).toBeGreaterThanOrEqual(
      1.1,
    )
    expect(light.surfaceFocused).toBe(light.surfacePressed)
    expect(dark.surfaceFocused).toBe(dark.surfacePressed)
  })

  it("keeps the legacy grey5, grey6 and grey7 aliases on the ruled values", () => {
    expect(light.grey5).toBe("#ECECEE")
    expect(light.grey6).toBe("#E1E1E3")
    expect(light.grey7).toBe("#F2F2F2")
    expect(dark.grey7).toBe("#171717")
  })

  // Design ruling (Nov 2026): the disabled accent label keeps following the
  // tappable fill, so it moves with it rather than holding the old #F2F2F4.
  it("keeps the disabled accent label on the tappable fill", () => {
    expect(light.textOnAccentDisabled).toBe("#ECECEE")
    expect(dark.textOnAccentDisabled.toUpperCase()).toBe("#1D1D1D")
  })

  // Static fills sit between the background and the tappable fill in both modes.
  it("orders static fills between the background and the tappable fill", () => {
    const luminance = (hex: string) => parseInt(hex.slice(1, 3), 16)

    expect(luminance(light.surfaceStatic)).toBeLessThan(
      luminance(light.backgroundDefault),
    )
    expect(luminance(light.surfaceStatic)).toBeGreaterThan(
      luminance(light.surfaceInteractive),
    )
    expect(luminance(dark.surfaceStatic)).toBeGreaterThan(
      luminance(dark.backgroundDefault),
    )
    expect(luminance(dark.surfaceStatic)).toBeLessThan(luminance(dark.surfaceInteractive))
  })
})

// No semantic alias: flagged for design review in colors.ts.
const flagged = ["blue5"]

describe("legacy name inventory", () => {
  // colors.ts, themed.d.ts, the alias map above and the eslint rule each list the
  // legacy names. colors-lint.spec.ts ties the eslint rule to themed.d.ts; this
  // ties themed.d.ts to the alias map.
  const deprecated = [
    ...fs
      .readFileSync(path.resolve(__dirname, "../themed.d.ts"), "utf8")
      .matchAll(/\/\*\* @deprecated[^*]*\*\/\s*(?:readonly )?(\w+):/g),
  ].map(([, name]) => name)

  it("marks exactly the aliased and flagged names deprecated in themed.d.ts", () => {
    expect(deprecated.sort()).toEqual(
      [...Object.keys(aliasToSemantic), ...flagged].sort(),
    )
  })
})

describe("static token lint guard", () => {
  // .eslintrc.json is JSON with comments, so read the restricted names as text
  // instead of parsing the file.
  const eslintrc = fs.readFileSync(
    path.resolve(__dirname, "../../../.eslintrc.json"),
    "utf8",
  )

  it("errors on every static token outside the allowlist", () => {
    const rule = eslintrc.match(/"no-restricted-properties": \[\s*"error",([\s\S]*?)\]/)
    expect(rule).not.toBeNull()

    const restricted = [...(rule?.[1] ?? "").matchAll(/"property": "(\w+)"/g)].map(
      ([, name]) => name,
    )
    const staticKeys = Object.keys(light).filter((key) => key.startsWith("static"))

    expect(restricted.sort()).toEqual(staticKeys.sort())
  })
})
