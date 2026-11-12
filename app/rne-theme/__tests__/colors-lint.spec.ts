/**
 * @jest-environment node
 */
import fs from "fs"
import path from "path"

import { describe, expect, it } from "@jest/globals"

import { light } from "../colors"

// Runs the repo's real .eslintrc.json against small fixtures, so the guard that
// carries the token migration (see app/rne-theme/colors.ts) is pinned by what
// ESLint reports, not by what the config text looks like.

type Message = { ruleId: string | null; severity: number; line: number }
type Linter = {
  lintText: (
    code: string,
    options: { filePath: string },
  ) => Promise<{ messages: Message[] }[]>
}
// eslint ships no type declarations in this repo
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ESLint } = require("eslint") as {
  ESLint: new (options: { cwd: string }) => Linter
}

const repoRoot = path.resolve(__dirname, "../../..")
const eslint = new ESLint({ cwd: repoRoot })

const LEGACY_RULE = "no-restricted-syntax"
const STATIC_RULE = "no-restricted-properties"

// A plain theme-aware screen: not in either static* override.
const SCREEN = "app/screens/home-screen/lint-fixture.tsx"
const STATIC_ALLOWED = "app/screens/receive-bitcoin-screen/lint-fixture.tsx"
const STATIC_UNDER_REVIEW = "app/components/circle/circle.tsx"

const lint = async (code: string, filePath = SCREEN): Promise<Message[]> => {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, filePath),
  })
  return result.messages
    .filter(({ ruleId }) => ruleId === LEGACY_RULE || ruleId === STATIC_RULE)
    .map(({ ruleId, severity, line }) => ({ ruleId, severity, line }))
}

const WARN = 1
const ERROR = 2

// `/** @deprecated … */` keys in themed.d.ts are the legacy names.
const deprecatedKeys = [
  ...fs
    .readFileSync(path.resolve(__dirname, "../themed.d.ts"), "utf8")
    .matchAll(/\/\*\* @deprecated[^*]*\*\/\s*(?:readonly )?(\w+):/g),
].map(([, name]) => name)

const paletteKeys = Object.keys(light)
const currentKeys = paletteKeys.filter((key) => !deprecatedKeys.includes(key))

describe("legacy color token lint", () => {
  it("finds the legacy names in themed.d.ts", () => {
    expect(deprecatedKeys.length).toBeGreaterThan(0)
    for (const key of deprecatedKeys) expect(paletteKeys).toContain(key)
  })

  it.each([
    ["colors.grey2", "const c = colors.grey2"],
    ["theme.colors.grey2", "const c = theme.colors.grey2"],
    ["darkColors.grey0", "const c = theme.darkColors?.grey0"],
    ["themeColors.primary", "const c = themeColors.primary"],
    ['colors["grey2"]', 'const c = colors["grey2"]'],
    ["{ grey2 } = colors", "const { grey2 } = colors"],
    ["{ grey2: g } = theme.colors", "const { grey2: g } = theme.colors"],
    ["{ colors: { grey2 } } = theme", "const { colors: { grey2 } } = theme"],
    [
      "{ theme: { colors: { grey2 } } } = useTheme()",
      "const { theme: { colors: { grey2 } } } = useTheme()",
    ],
    [
      "makeStyles(({ colors: { grey2 } }) => …)",
      "makeStyles(({ colors: { grey2 } }) => ({ a: { color: grey2 } }))",
    ],
    ["({ grey2 } = colors)", "let grey2; ({ grey2 } = colors)"],
  ])("warns on %s", async (_, code) => {
    expect(await lint(code)).toEqual([
      expect.objectContaining({ ruleId: LEGACY_RULE, severity: WARN }),
    ])
  })

  it("warns on every legacy name, by member access and by destructuring", async () => {
    for (const key of deprecatedKeys) {
      const member = await lint(`const c = colors.${key}`)
      const destructured = await lint(`const { ${key}: c } = theme.colors`)
      expect({ key, rules: member.map(({ ruleId }) => ruleId) }).toEqual({
        key,
        rules: [LEGACY_RULE],
      })
      expect({ key, rules: destructured.map(({ ruleId }) => ruleId) }).toEqual({
        key,
        rules: [LEGACY_RULE],
      })
    }
  })

  it("does not warn on any current token", async () => {
    const nonStatic = currentKeys.filter((key) => !key.startsWith("static"))
    const code = nonStatic.map((key, i) => `const c${i} = colors.${key}`).join("\n")
    const destructured = `const { ${nonStatic.join(", ")} } = theme.colors`

    expect(await lint(code)).toEqual([])
    expect(await lint(destructured)).toEqual([])
  })

  it("leaves legacy names on objects that are not a palette alone", async () => {
    expect(await lint("const c = variant.primary.title")).toEqual([])
    expect(await lint("const { primary } = variant")).toEqual([])
  })

  // Known gap, documented in .eslintrc.json: a key chosen at runtime is invisible.
  it("cannot see a key looked up at runtime", async () => {
    expect(await lint('const name = "grey2"; const c = colors[name]')).toEqual([])
  })
})

describe("static color token lint", () => {
  it.each([
    ["colors.staticWhite", "const c = colors.staticWhite"],
    ["{ staticWhite } = colors", "const { staticWhite } = colors"],
  ])("errors on %s on a theme-aware screen", async (_, code) => {
    expect(await lint(code)).toEqual([
      expect.objectContaining({ ruleId: STATIC_RULE, severity: ERROR }),
    ])
  })

  it("allows static tokens on the allowlisted screens", async () => {
    expect(await lint("const c = colors.staticWhite", STATIC_ALLOWED)).toEqual([])
  })

  it("only warns in files whose static tokens are under review", async () => {
    expect(await lint("const c = colors.staticWhite", STATIC_UNDER_REVIEW)).toEqual([
      expect.objectContaining({ ruleId: STATIC_RULE, severity: WARN }),
    ])
  })

  it("errors on every static token", async () => {
    for (const key of paletteKeys.filter((name) => name.startsWith("static"))) {
      const hits = await lint(`const c = colors.${key}`)
      expect({ key, hits }).toEqual({
        key,
        hits: [expect.objectContaining({ ruleId: STATIC_RULE, severity: ERROR })],
      })
    }
  })
})
