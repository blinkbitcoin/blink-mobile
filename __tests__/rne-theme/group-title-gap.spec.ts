import { readFileSync } from "fs"
import { join } from "path"

import { groupTitleGap, spacing } from "@app/rne-theme/tokens"

/**
 * The gap between a group title and the card or list it labels is `groupTitleGap`
 * (5, blink-wip#2107). It replaced a hardcoded 3 on titled groups; SettingsGroup already
 * drew 5. Field labels and other 3px spacing are out of scope and keep their literals.
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")

// The title-to-group styles that read the token, and how many in each file. A style put
// back to a literal lowers a count.
const TITLED_GROUPS: Record<string, number> = {
  "app/components/card-screen/info-section.tsx": 1,
  "app/screens/card-screen/card-fee-schedule-screen.tsx": 1,
  "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx": 1,
  "app/screens/card-screen/card-personal-details-screen/card-personal-details-screen.tsx": 1,
  "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx": 3,
  "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx": 1,
  "app/screens/card-screen/order-card-screens/steps/shared-styles.ts": 1,
  "app/screens/card-screen/replace-card-screens/steps/shared-styles.ts": 1,
  "app/screens/settings-screen/group.tsx": 1,
}

// Field label to field spacing, which the ticket keeps at 3.
const FIELD_LABELS = [
  "app/components/action-field/action-field.tsx",
  "app/components/card-screen/input-field.tsx",
  "app/components/password-input/password-input.tsx",
  "app/screens/settings-screen/self-custodial/account-fields.tsx",
  "app/screens/totp-screen/setup-key-backup-screen.tsx",
]

const TOKEN_USE = /^\s*(gap|marginTop): groupTitleGap,$/
const LITERAL_GAP = /^\s*(gap|marginTop|marginBottom): 3,$/

const lines = (file: string) => readFileSync(join(REPO_ROOT, file), "utf8").split("\n")

describe("group title gap", () => {
  it("is 5", () => {
    expect(groupTitleGap).toBe(5)
    expect(groupTitleGap).toBe(spacing.sm)
  })

  Object.entries(TITLED_GROUPS).forEach(([file, count]) => {
    it(`${file} reads the token ${count}×`, () => {
      expect(lines(file).filter((line) => TOKEN_USE.test(line))).toHaveLength(count)
    })

    it(`${file} has no 3px gap left`, () => {
      expect(lines(file).filter((line) => LITERAL_GAP.test(line))).toEqual([])
    })
  })

  FIELD_LABELS.forEach((file) => {
    it(`${file} keeps its 3px field label gap`, () => {
      const source = lines(file)
      expect(source.filter((line) => TOKEN_USE.test(line))).toEqual([])
      expect(source.some((line) => /^\s*(gap|marginBottom): 3,$/.test(line))).toBe(true)
    })
  })
})
