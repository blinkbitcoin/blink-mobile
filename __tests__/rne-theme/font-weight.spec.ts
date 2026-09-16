import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * Bold in the app is 700. A 600 weight renders SemiBold on iOS and the same synthesised
 * bold as 700 on Android, so the two platforms drift apart. The artifact under test is
 * the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
const SEMIBOLD = /fontWeight:[^,\n]*["']600["']|fontWeight:\s*600\b|SemiBold/

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe("font weights", () => {
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
})
