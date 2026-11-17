import { readFileSync } from "fs"
import { join } from "path"

import { groupTitleGap, spacing } from "@app/rne-theme/tokens"

/**
 * A title above a card, field, group or button sits `groupTitleGap` (5) above it and is
 * drawn in `textSecondary` (blink-wip#2107, Figma `section` 31473:4243). The gap replaced
 * hardcoded 3, 4, 6, 8 and 20; the colour replaced `textOnBackground` and `textMuted`.
 * Headings (h1/h2, bold section headers) and titles beside a field are out of scope.
 * A title that is not regular 14px stays out, except the Galoy address and fee-rate titles,
 * which were already regular 16px. Send is being replaced and is not judged for size.
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
  "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx": 2,
  "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx": 1,
  "app/screens/card-screen/order-card-screens/steps/shared-styles.ts": 1,
  "app/screens/card-screen/replace-card-screens/steps/shared-styles.ts": 1,
  "app/screens/galoy-address-screen/address-component.tsx": 1,
  "app/screens/people-screen/contacts/contact-transactions.tsx": 1,
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
  ["app/screens/card-screen/order-card-screens/steps/shared-styles.ts", "sectionTitle"],
  ["app/screens/card-screen/replace-card-screens/steps/shared-styles.ts", "sectionTitle"],
  ["app/screens/galoy-address-screen/address-component.tsx", "addressTitle"],
  ["app/screens/people-screen/contacts/contact-transactions.tsx", "sectionHeaderText"],
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
]

const TOKEN_USE = /^\s*(gap|rowGap|marginTop|marginBottom): groupTitleGap,$/

// Send is being replaced. Its bold titles stay as this PR left them.
const SEND_TITLES = new Set([
  "app/screens/send-bitcoin-screen/fee-tier-selector.tsx",
  "app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.tsx",
  "app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx",
  "app/screens/send-bitcoin-screen/send-bitcoin-details-screen.tsx",
])

// Regular 16px before this migration. Size stays; colour and gap follow the rule.
const PREEXISTING_16 = new Set([
  "app/screens/galoy-address-screen/address-component.tsx",
  "app/screens/settings-screen/fee-rates-screen.tsx",
])

const isBold = (block: string) =>
  /fontWeight:\s*"?(?:bold|700)"?/.test(block) || /fonts\.bold/.test(block)

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

  TITLE_STYLES.forEach(([file, key]) => {
    if (SEND_TITLES.has(file)) return

    it(`${file} ${key} stays a regular title at its pre-existing size`, () => {
      const block = styleBlock(file, key)
      expect(isBold(block)).toBe(false)
      const size = block.match(/fontSize:\s*(\d+)/)
      if (PREEXISTING_16.has(file)) {
        expect(size?.[1]).toBe("16")
        return
      }
      if (size) expect(size[1]).toBe("14")
    })
  })

  it("leaves titles outside the 14px regular contract unchanged", () => {
    const personal = source(
      "app/screens/card-screen/onboarding/card-flow/personal-information-screen.tsx",
    )
    expect(personal).not.toContain("groupTitleGap")
    expect(personal).not.toContain("textSecondary")
    expect(personal).toContain("gap: 6,")

    const deposits = styleBlock(
      "app/screens/unclaimed-deposits/unclaimed-deposits-screen.tsx",
      "fieldLabel",
    )
    expect(deposits).toMatch(/color: colors\.textMuted/)
    expect(deposits).toMatch(/marginBottom: 8/)
    expect(deposits).toMatch(/fonts\.bold/)
    expect(
      source("app/screens/unclaimed-deposits/unclaimed-deposits-screen.tsx"),
    ).not.toContain("groupTitleGap")

    expect(
      styleBlock(
        "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx",
        "dangerZoneSection",
      ),
    ).toMatch(/gap: 3,/)
  })

  it("the API key expiry label is textSecondary", () => {
    expect(source("app/screens/settings-screen/api/api-key-create-screen.tsx")).toMatch(
      /<Text type="p3" color=\{colors\.textSecondary\}>\s*\{LL\.ApiScreen\.expiry\(\)\}/,
    )
  })

  it("SettingsGroup titles are Paragraph 14/20", () => {
    const title = styleBlock("app/screens/settings-screen/group.tsx", "title")
    expect(title).toMatch(/^\s*fontSize: 14,$/m)
    expect(title).toMatch(/^\s*lineHeight: cappedLineHeight\(20\),$/m)
  })

  it("SettingsGroup applies its title style before the caller's", () => {
    expect(source("app/screens/settings-screen/group.tsx")).toContain(
      "style={[styles.title, titleStyle]}",
    )
  })
})
