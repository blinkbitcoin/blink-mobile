import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

import { circleDiameterThatContainsSquare } from "@app/components/atomic/galoy-icon/galoy-icon"
import {
  HEADER_ICON_BUTTON_TOUCH_PADDING,
  HEADER_ICON_TOUCH_SIZE,
  headerIconButtonTouchPaddingAbove,
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
const USES_STANDARD =
  /HEADER_ICON_TOUCH_SIZE|HEADER_ICON_BUTTON_TOUCH_PADDING|headerIconTouchArea|headerIconButtonTouchPaddingAbove/
/** A margin written as a negative number, such as `marginLeft: -14`. */
const NEGATIVE_MARGIN = /margin\w*:\s*-/i

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

  it("pads a medium icon button out to the 48dp box", () => {
    expect(
      circleDiameterThatContainsSquare(24) + 2 * HEADER_ICON_BUTTON_TOUCH_PADDING,
    ).toBe(HEADER_ICON_TOUCH_SIZE)
    expect(headerIconButtonTouchPaddingAbove).not.toHaveProperty("bottom")
  })

  /** The native header item is sized to its child's margin box, and a touch outside it
   *  never reaches the child. A negative margin that hands back a box's growth therefore
   *  hands back its touch area too, so header controls place their box with positive
   *  margins only. */
  it("is never cancelled by a negative margin", () => {
    const offenders = sourceFiles(APP_DIR)
      .filter((path) => {
        const source = readFileSync(path, "utf8")
        return HEADER_ITEM.test(source) || USES_STANDARD.test(source)
      })
      .filter((path) => NEGATIVE_MARGIN.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO_ROOT, path))

    expect(offenders).toEqual([])
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
