import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * Bold in the app is 700 and there is no SemiBold face. On iOS a 600 weight draws a
 * SemiBold face; on Android a weight under 700 loads the regular file, so the same text
 * is not bold at all. The artifact under test is the style source, so source-coupling
 * here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
// A 600 or "semibold" weight, or a SemiBold face named in a string. Comments may say SemiBold.
const SEMIBOLD =
  /fontWeight:[^,\n]*(["'`](600|semibold)["'`]|\b600\b)|["'`][^"'`\n]*SemiBold[^"'`\n]*["'`]/i
const THEMED_TEXT_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\bText\b[^}]*\}\s*from\s*["']@rn-vui\/themed["']/
const BOLD_WEIGHT = /fontWeight:[^,\n]*(["'](bold|[7-9]00)["']|\b[7-9]00\b)/

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe("font weights", () => {
  const flagged = [
    'fontWeight: "600",',
    "fontWeight: '600',",
    "fontWeight: 600,",
    'fontWeight: "600" as const,',
    'fontWeight: clear ? "bold" : "600",',
    "fontWeight: `600`,",
    'fontWeight: "semibold",',
    'fontFamily: "SourceSansPro-SemiBold",',
  ]
  flagged.forEach((line) => {
    it(`flags ${line}`, () => {
      expect(SEMIBOLD.test(line)).toBe(true)
    })
  })

  const allowed = [
    'fontWeight: "700",',
    'fontFamily: "SourceSansPro-Bold",',
    "// was SemiBold before #1304",
    "// semibold system face",
  ]
  allowed.forEach((line) => {
    it(`allows ${line}`, () => {
      expect(SEMIBOLD.test(line)).toBe(false)
    })
  })

  it("never sets a 600 (SemiBold) weight in app code", () => {
    const offenders = sourceFiles(APP_DIR).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          SEMIBOLD.test(line) ? [`${relative(REPO_ROOT, file)}:${index + 1}`] : [],
        ),
    )

    expect(offenders).toEqual([])
  })

  /**
   * The themed `Text` names a Source Sans Pro face. A weight of 700 or more on top of it
   * makes Android look for `<face>_bold.ttf`, which does not exist, and draw Roboto Bold;
   * bold text uses `fontFamily: fonts.bold` instead. The rules below predate that and are
   * migrated over time, so this only fails when a new one is added. Lower the count when
   * you migrate one.
   */
  it("adds no bold weight to text styled by the themed Text", () => {
    const KNOWN_BOLD_WEIGHTS = 94

    const boldWeights = sourceFiles(APP_DIR)
      .map((file) => readFileSync(file, "utf8"))
      .filter((source) => THEMED_TEXT_IMPORT.test(source))
      .flatMap((source) => source.split("\n").filter((line) => BOLD_WEIGHT.test(line)))

    expect(boldWeights.length).toBeLessThanOrEqual(KNOWN_BOLD_WEIGHTS)
  })
})
