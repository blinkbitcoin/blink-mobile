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
  primary3: "accent2",
  primary4: "accent3",
  primary5: "accent4",
  grey0: "textPrimary",
  grey1: "textSecondary",
  grey2: "textMuted",
  grey3: "textDisabled",
  grey4: "border",
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
}

// Role tokens share their source token's value until design gives them their own.
// Drop an entry here in the same change that gives that role a value of its own.
const roleToSource: Record<string, string> = {
  textOnAccent: "backgroundDefault",
  textOnAccentDisabled: "surfaceInteractive",
  textPlaceholder: "border",
  borderStrong: "textDisabled",
  surfaceMuted: "border",
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

// No semantic alias yet: flagged for design review in colors.ts.
const blues = ["blue5", "_blue", "_lightBlue", "_sky"]

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
    expect(deprecated.sort()).toEqual([...Object.keys(aliasToSemantic), ...blues].sort())
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
