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

// The surfaces blink-wip#1871 moved to the static fill, and how many in each file. A swap
// put back to `surfaceInteractive` lowers a count, which the guard above can't see.
const STATIC_SURFACES: Record<string, number> = {
  "app/components/card-screen/info-card.tsx": 1,
  "app/components/card-screen/info-section.tsx": 1,
  "app/components/card-screen/input-field.tsx": 1,
  "app/components/card-screen/multi-line-field.tsx": 1,
  "app/components/galoy-toast/galoy-toast.tsx": 1,
  "app/components/info-banner/info-banner.tsx": 1,
  "app/components/mnemonic-words-grid/mnemonic-words-grid.tsx": 1,
  "app/components/network-status-banner/network-status-banner.tsx": 1,
  "app/components/restricted-region/restricted-region-banner.tsx": 1,
  "app/components/warning-card/warning-card.tsx": 1,
  "app/screens/account-migration/balance-pair-card.tsx": 1,
  "app/screens/account-migration/to-non-custodial/contact-support-screen.tsx": 1,
  "app/screens/account-migration/to-non-custodial/merchant-tools-screen.tsx": 1,
  "app/screens/account-type-selection/account-type-selection.tsx": 1,
  "app/screens/card-screen/card-fee-schedule-screen.tsx": 4,
  "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx": 1,
  "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx": 1,
  "app/screens/card-screen/onboarding/card-flow/card-details-screen.tsx": 1,
  "app/screens/card-screen/onboarding/card-flow/card-subscription-screen.tsx": 1,
  "app/screens/card-screen/onboarding/investment-flow/term-sheet-screen.tsx": 1,
  "app/screens/conversion-flow/conversion-confirmation-screen.tsx": 2,
  "app/screens/conversion-flow/conversion-fee-row.tsx": 1,
  "app/screens/home-screen/home-screen.tsx": 1,
  "app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen.tsx": 1,
  "app/screens/settings-screen/self-custodial/account-fields.tsx": 1,
  "app/screens/totp-screen/authenticator-intro-screen.tsx": 1,
  "app/screens/totp-screen/authenticator-protected-screen.tsx": 1,
  "app/screens/transaction-detail-screen/transaction-detail-screen.tsx": 2,
}

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

  it("keeps every surface moved to the static fill on it", () => {
    const counts = Object.fromEntries(
      Object.keys(STATIC_SURFACES).map((file) => [
        file,
        readFileSync(join(REPO_ROOT, file), "utf8").split("staticSurface(colors)")
          .length - 1,
      ]),
    )

    expect(counts).toEqual(STATIC_SURFACES)
  })

  it("paints the static fill alone in both modes", () => {
    for (const colors of [light, dark]) {
      expect(staticSurface(colors)).toEqual({ backgroundColor: colors.surfaceStatic })
    }
  })
})
