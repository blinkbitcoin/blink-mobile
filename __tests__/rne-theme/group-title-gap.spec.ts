import { readFileSync } from "fs"
import { join } from "path"

import { groupTitleGap, spacing } from "@app/rne-theme/tokens"

/**
 * A title above a card, field, group or button sits `groupTitleGap` (5) above it and is
 * drawn in `textSecondary` (blink-wip#2107, Figma `section` 31473:4243). The gap replaced
 * hardcoded 3, 4, 6, 8 and 20; the colour replaced `textOnBackground` and `textMuted`.
 * Headings (h1/h2, bold section headers) and titles beside a field are out of scope.
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")

// How many title gaps each file draws with the token. A gap put back to a literal
// lowers a count.
const TITLE_GAPS: Record<string, number> = {
  "app/components/action-field/action-field.tsx": 1,
  "app/components/card-screen/card-transactions-section.tsx": 1,
  "app/components/card-screen/info-section.tsx": 1,
  "app/components/card-screen/input-field.tsx": 1,
  "app/components/map-component/add-place-panel.tsx": 1,
  "app/components/password-input/password-input.tsx": 1,
  "app/screens/card-screen/card-fee-schedule-screen.tsx": 1,
  "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx": 1,
  "app/screens/card-screen/card-personal-details-screen/card-personal-details-screen.tsx": 1,
  "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx": 3,
  "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx": 1,
  "app/screens/card-screen/onboarding/card-flow/personal-information-screen.tsx": 1,
  "app/screens/card-screen/order-card-screens/steps/shared-styles.ts": 1,
  "app/screens/card-screen/replace-card-screens/steps/shared-styles.ts": 1,
  "app/screens/galoy-address-screen/address-component.tsx": 1,
  "app/screens/send-bitcoin-screen/fee-tier-selector.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-details-screen.tsx": 1,
  "app/screens/settings-screen/api/api-key-create-screen.tsx": 1,
  "app/screens/settings-screen/fee-rates-screen.tsx": 1,
  "app/screens/settings-screen/group.tsx": 1,
  "app/screens/settings-screen/self-custodial/account-fields.tsx": 1,
  "app/screens/totp-screen/setup-key-backup-screen.tsx": 1,
  "app/screens/transaction-detail-screen/transaction-detail-screen.tsx": 1,
  "app/screens/unclaimed-deposits/unclaimed-deposits-screen.tsx": 1,
}

// The title's style key in each file. The card danger zone title stays `error`.
const TITLE_STYLES: [string, string][] = [
  ["app/components/action-field/action-field.tsx", "label"],
  ["app/components/card-screen/card-transactions-section.tsx", "dateLabel"],
  ["app/components/card-screen/info-section.tsx", "title"],
  ["app/components/card-screen/input-field.tsx", "label"],
  ["app/components/map-component/add-place-panel.tsx", "label"],
  ["app/components/password-input/password-input.tsx", "label"],
  ["app/screens/card-screen/card-fee-schedule-screen.tsx", "sectionLabel"],
  [
    "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx",
    "currentLimitsTitle",
  ],
  [
    "app/screens/card-screen/card-personal-details-screen/card-personal-details-screen.tsx",
    "sectionTitle",
  ],
  [
    "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx",
    "sectionTitle",
  ],
  [
    "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx",
    "sectionLabel",
  ],
  [
    "app/screens/card-screen/onboarding/card-flow/personal-information-screen.tsx",
    "label",
  ],
  ["app/screens/card-screen/order-card-screens/steps/shared-styles.ts", "sectionTitle"],
  ["app/screens/card-screen/replace-card-screens/steps/shared-styles.ts", "sectionTitle"],
  ["app/screens/galoy-address-screen/address-component.tsx", "addressTitle"],
  ["app/screens/send-bitcoin-screen/fee-tier-selector.tsx", "title"],
  [
    "app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.tsx",
    "fieldTitleText",
  ],
  [
    "app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx",
    "fieldTitleText",
  ],
  ["app/screens/send-bitcoin-screen/send-bitcoin-details-screen.tsx", "fieldTitleText"],
  ["app/screens/settings-screen/fee-rates-screen.tsx", "sectionTitle"],
  ["app/screens/settings-screen/group.tsx", "title"],
  ["app/screens/settings-screen/self-custodial/account-fields.tsx", "label"],
  ["app/screens/totp-screen/setup-key-backup-screen.tsx", "manualCopyLabel"],
  ["app/screens/transaction-detail-screen/transaction-detail-screen.tsx", "entry"],
  ["app/screens/unclaimed-deposits/unclaimed-deposits-screen.tsx", "fieldLabel"],
]

const TOKEN_USE = /^\s*(gap|rowGap|marginTop|marginBottom): groupTitleGap,$/

const source = (file: string) => readFileSync(join(REPO_ROOT, file), "utf8")

const styleBlock = (file: string, key: string) => {
  const match = source(file).match(
    new RegExp(`^( +)${key}: \\{\\n([\\s\\S]*?)^\\1\\},?$`, "m"),
  )
  if (!match) throw new Error(`${file} has no ${key} style`)
  return match[2]
}

describe("group title", () => {
  it("gap is 5", () => {
    expect(groupTitleGap).toBe(5)
    expect(groupTitleGap).toBe(spacing.sm)
  })

  Object.entries(TITLE_GAPS).forEach(([file, count]) => {
    it(`${file} draws ${count} title gap(s) with the token`, () => {
      const uses = source(file)
        .split("\n")
        .filter((line) => TOKEN_USE.test(line))
      expect(uses).toHaveLength(count)
    })
  })

  TITLE_STYLES.forEach(([file, key]) => {
    it(`${file} ${key} is textSecondary`, () => {
      expect(styleBlock(file, key)).toMatch(/^\s*color: colors\.textSecondary,$/m)
    })
  })

  it("the API key expiry label is textSecondary", () => {
    expect(source("app/screens/settings-screen/api/api-key-create-screen.tsx")).toMatch(
      /<Text type="p3" color=\{colors\.textSecondary\}>\s*\{LL\.ApiScreen\.expiry\(\)\}/,
    )
  })

  it("SettingsGroup titles are Paragraph 14/20", () => {
    const title = styleBlock("app/screens/settings-screen/group.tsx", "title")
    expect(title).toMatch(/^\s*fontSize: 14,$/m)
    expect(title).toMatch(/^\s*lineHeight: 20,$/m)
  })

  it("SettingsGroup applies its title style before the caller's", () => {
    expect(source("app/screens/settings-screen/group.tsx")).toContain(
      "style={[styles.title, titleStyle]}",
    )
  })
})
