import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * Weight comes from the face, never from `fontWeight`. Android loads a `fontFamily` from
 * `fonts/<name>.ttf`, or `<name>_bold.ttf` for a weight of 700 or more, and draws Roboto
 * when that file is missing; a weight under 700 loads the regular file. So a bold weight
 * on a Source Sans Pro face is Roboto Bold, a 600 is not bold at all, and a family named
 * "Source Sans Pro" (iOS's family name, not a file) is Roboto. App code names a face from
 * `@app/rne-theme/fonts`; only the theme sets a weight. The artifact under test is the
 * style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
const THEME_DIR = join(APP_DIR, "rne-theme")

const WEIGHT = /\bfontWeight\s*:/
// A face named by string instead of through `fonts`.
const LITERAL_FACE = /\bfontFamily\s*:\s*["'`]/
const COMMENT = /^\s*(\/\/|\/?\*)/

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

const offenders = (pattern: RegExp) =>
  sourceFiles(APP_DIR)
    .filter((file) => !file.startsWith(THEME_DIR))
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          !COMMENT.test(line) && pattern.test(line)
            ? [`${relative(REPO_ROOT, file)}:${index + 1}`]
            : [],
        ),
    )

describe("font weights", () => {
  const weights = [
    'fontWeight: "700",',
    'fontWeight: "bold",',
    'fontWeight: "600",',
    "fontWeight: 600,",
    'fontWeight: "400",',
    'fontWeight: "bold" as const,',
    'fontWeight: isBold ? "700" : "400",',
    'boldText: { fontWeight: "700" },',
  ]
  weights.forEach((line) => {
    it(`flags ${line}`, () => {
      expect(WEIGHT.test(line)).toBe(true)
    })
  })

  const literalFaces = [
    'fontFamily: "Source Sans Pro",',
    "fontFamily: 'SourceSansPro-Bold',",
    'fontFamily: "SourceSansPro-SemiBold",',
    "fontFamily: `SourceSansPro-Regular`,",
  ]
  literalFaces.forEach((line) => {
    it(`flags ${line}`, () => {
      expect(LITERAL_FACE.test(line)).toBe(true)
    })
  })

  const allowed = [
    "fontFamily: fonts.bold,",
    "fontFamily: isBold ? fonts.bold : fonts.regular,",
    '// fontWeight: "700" here would draw Roboto Bold',
    ' * fontFamily: "Source Sans Pro" is Roboto on Android',
  ]
  allowed.forEach((line) => {
    it(`allows ${line}`, () => {
      expect(!COMMENT.test(line) && (WEIGHT.test(line) || LITERAL_FACE.test(line))).toBe(
        false,
      )
    })
  })

  it("sets no fontWeight in app code outside the theme", () => {
    expect(offenders(WEIGHT)).toEqual([])
  })

  it("names every face through fonts, never by string", () => {
    expect(offenders(LITERAL_FACE)).toEqual([])
  })
})

/**
 * `@rn-vui/base` components never see the theme, so its default faces don't reach them:
 * the base Button title names Android's `sans-serif-medium`, and the base SearchBar input
 * names none. Each use has to pass its own face.
 */
describe("@rn-vui/base text faces", () => {
  const baseImports = sourceFiles(APP_DIR)
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => /from "@rn-vui\/base"/.test(source))

  // Every use in the app is self-closing, with `/>` on its own line.
  const elements = (tag: string) =>
    baseImports
      .filter(({ source }) =>
        new RegExp(`import \\{[^}]*\\b${tag}\\b[^}]*\\} from "@rn-vui/base"`).test(
          source,
        ),
      )
      .flatMap(({ file, source }) =>
        [...source.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?\\n\\s*/>`, "g"))].map(
          (match) => ({ file: relative(REPO_ROOT, file), props: match[0] }),
        ),
      )

  it("gives every base Button with a title its own title face", () => {
    const buttons = elements("Button").filter(({ props }) => /\btitle=/.test(props))

    expect(buttons.length).toBeGreaterThan(0)
    expect(
      buttons.filter(({ props }) => !/\btitleStyle=/.test(props)).map(({ file }) => file),
    ).toEqual([])
  })

  it("gives every base SearchBar its own input face", () => {
    const searchBars = elements("SearchBar")

    expect(searchBars.length).toBeGreaterThan(0)
    expect(
      searchBars
        .filter(({ props }) => !/\binputStyle=/.test(props))
        .map(({ file }) => file),
    ).toEqual([])
  })
})
