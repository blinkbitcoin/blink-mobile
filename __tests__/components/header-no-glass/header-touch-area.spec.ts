import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

import {
  HEADER_ICON_TOUCH_SIZE,
  headerIconTouchArea,
} from "@app/components/header-no-glass"

/**
 * Header controls get a touch box of at least 48dp, Material's minimum. `hitSlop` can't
 * provide it: on Android a touch outside the parent's bounds never reaches the child, and
 * the native header wraps each item in a view sized to its content. So every header item
 * has to size its own box from the shared standard. The artifact under test is the
 * header source, so source-coupling here is intentional: a new header item that skips
 * the standard fails here instead of shipping a small target.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
const HEADER_ITEM = /header(Right|Left)NoGlass\(/
const USES_STANDARD = /HEADER_ICON_TOUCH_SIZE|headerIconTouchArea/

/** Header items whose box meets the standard without it, and why. */
const MEETS_IT_ALREADY: Record<string, string> = {
  // 24dp icon with 12dp padding all round: a 48dp box.
  "app/screens/receive-bitcoin-screen/nfc-header-button.tsx": "48dp from padding",
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe("header touch area", () => {
  it("is at least 48dp square", () => {
    expect(HEADER_ICON_TOUCH_SIZE).toBeGreaterThanOrEqual(48)
    expect(headerIconTouchArea).toMatchObject({
      width: HEADER_ICON_TOUCH_SIZE,
      height: HEADER_ICON_TOUCH_SIZE,
    })
  })

  it("is used by every file that renders a header item", () => {
    const offenders = sourceFiles(APP_DIR)
      .filter((path) => HEADER_ITEM.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO_ROOT, path))
      .filter((path) => !(path in MEETS_IT_ALREADY))
      .filter((path) => !USES_STANDARD.test(readFileSync(join(REPO_ROOT, path), "utf8")))

    expect(offenders).toEqual([])
  })

  it("keeps the allowlist to files that still render a header item", () => {
    const stale = Object.keys(MEETS_IT_ALREADY).filter(
      (path) => !HEADER_ITEM.test(readFileSync(join(REPO_ROOT, path), "utf8")),
    )

    expect(stale).toEqual([])
  })
})
