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

describe("color token aliases", () => {
  const checkAliases = (palette: Record<string, string>) => {
    for (const [legacy, semantic] of Object.entries(aliasToSemantic)) {
      expect(palette[legacy]).toBeDefined()
      expect(palette[semantic]).toBeDefined()
      expect(palette[legacy]).toEqual(palette[semantic])
    }
  }

  it("every legacy alias matches its semantic token in light mode", () => {
    checkAliases(light as unknown as Record<string, string>)
  })

  it("every legacy alias matches its semantic token in dark mode", () => {
    checkAliases(dark as unknown as Record<string, string>)
  })

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
