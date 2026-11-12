import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

import { dark, light } from "@app/rne-theme/colors"
import { staticSurface } from "@app/rne-theme/surfaces"

/**
 * A static surface is `surfaceStatic`, and it is named in one place: `staticSurface` in
 * `app/rne-theme/surfaces.ts`. A surface that reaches for `colors.surfaceStatic` (or its
 * deprecated alias `colors.grey7`) directly drifts when the static surface changes, so app
 * code may not name it at all.
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
// The static fill under its semantic name or its deprecated alias, outside a comment.
const STATIC_FILL = /^(?!\s*(\/\/|\/?\*)).*\bcolors\.(grey7|surfaceStatic)\b/
// colors.ts defines the value, themed.d.ts types it, surfaces.ts is the one user.
const DEFINITIONS = ["colors.ts", "themed.d.ts", "surfaces.ts"].map((name) =>
  join(APP_DIR, "rne-theme", name),
)

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe("static surfaces", () => {
  const flagged = [
    "    backgroundColor: colors.surfaceStatic,",
    "    backgroundColor: colors.grey7,",
    "  const fill = isStatic ? colors.surfaceStatic : colors.surfaceInteractive",
  ]
  flagged.forEach((line) => {
    it(`flags ${line.trim()}`, () => {
      expect(STATIC_FILL.test(line)).toBe(true)
    })
  })

  const allowed = [
    "    ...staticSurface(colors),",
    "    backgroundColor: colors.surfaceInteractive,",
    "  /** Static, so `colors.surfaceStatic` */",
    "   * colors.surfaceStatic on the black background",
    "  // colors.surfaceStatic alone is too faint",
  ]
  allowed.forEach((line) => {
    it(`allows ${line.trim()}`, () => {
      expect(STATIC_FILL.test(line)).toBe(false)
    })
  })

  it("names the static fill only in app/rne-theme/surfaces.ts", () => {
    const offenders = sourceFiles(APP_DIR)
      .filter((file) => !DEFINITIONS.includes(file))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            STATIC_FILL.test(line) ? [`${relative(REPO_ROOT, file)}:${index + 1}`] : [],
          ),
      )

    expect(offenders).toEqual([])
  })

  it("paints the static fill alone in both modes", () => {
    for (const colors of [light, dark]) {
      expect(staticSurface(colors)).toEqual({ backgroundColor: colors.surfaceStatic })
    }
  })
})
