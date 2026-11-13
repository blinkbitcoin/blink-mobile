import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * The dark layer behind a modal or sheet is `colors.scrim`, defined once in
 * `app/rne-theme/colors.ts`. A black rgba written at a call site drifts from it, so app
 * code may not write one. The card art's text shadow is not a scrim (ruled on
 * blink-wip#1871).
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
// A translucent black, as rgba (comma or space syntax) or as hex with alpha, outside a
// comment and outside a shadow. Shadows are not scrims.
const BLACK_RGBA =
  /^(?!\s*(\/\/|\/?\*))(?!.*[sS]hadowColor).*(rgba\(\s*0[\s,]+0[\s,]+0[\s,/]|["'`]#(000[0-9a-f]|000000[0-9a-f]{2})["'`])/i
// A use of the token, not a longer name such as `colors.scrimStrong`.
const SCRIM_USE = /\bcolors\.scrim\b/g
const isComment = (line: string) => /^\s*(\/\/|\/?\*)/.test(line)
const DEFINITION = join(APP_DIR, "rne-theme", "colors.ts")

// The scrims blink-wip#1871 moved to the token, and how many in each file. A call site put
// back to an inline rgba lowers a count, which the guard above alone would also catch, but
// one moved to another token (`backdrop`, say) only shows up here.
const SCRIMS: Record<string, number> = {
  "app/components/amount-input/amount-input-modal.tsx": 1,
  "app/components/bottom-sheet/index.tsx": 1,
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.[jt]sx?$/.test(name) ? [path] : []
  })

describe("scrim", () => {
  const flagged = [
    '    backgroundColor: "rgba(0,0,0,0.5)",',
    'const SCRIM_COLOR = "rgba(0, 0, 0, 0.4)"',
    '    backgroundColor: "rgba(0 0 0 / 50%)",',
    '    backgroundColor: "#00000080",',
    '    backgroundColor: "#0008",',
  ]
  flagged.forEach((line) => {
    it(`flags ${line.trim()}`, () => {
      expect(BLACK_RGBA.test(line)).toBe(true)
    })
  })

  const allowed = [
    "    backgroundColor: colors.scrim,",
    '    textShadowColor: "rgba(0, 0, 0, 0.3)",',
    "  // the old rgba(0, 0, 0, 0.4) scrim",
    '    backgroundColor: "rgba(255, 255, 255, 0.06)",',
    '    shadowColor: "rgba(0, 0, 0, 0.2)",',
    '    backgroundColor: "#000000",',
  ]
  allowed.forEach((line) => {
    it(`allows ${line.trim()}`, () => {
      expect(BLACK_RGBA.test(line)).toBe(false)
    })
  })

  it("writes no black rgba outside app/rne-theme/colors.ts", () => {
    const offenders = sourceFiles(APP_DIR)
      .filter((file) => file !== DEFINITION)
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            BLACK_RGBA.test(line) ? [`${relative(REPO_ROOT, file)}:${index + 1}`] : [],
          ),
      )

    expect(offenders).toEqual([])
  })

  it("keeps every scrim moved to the token on it", () => {
    const counts = Object.fromEntries(
      Object.keys(SCRIMS).map((file) => [
        file,
        readFileSync(join(REPO_ROOT, file), "utf8")
          .split("\n")
          .filter((line) => !isComment(line))
          .reduce((count, line) => count + (line.match(SCRIM_USE)?.length ?? 0), 0),
      ]),
    )

    expect(counts).toEqual(SCRIMS)
  })
})
