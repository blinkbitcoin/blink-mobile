import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

import { radius } from "@app/rne-theme/radius"

/**
 * Cards, inputs, non-pill buttons, banners, toasts and list rows take their corners from
 * `radius.default` (blink-wip#2106). 8 is deprecated and 10 was an undocumented near-miss,
 * so a literal 8 or 10 is allowed only on the pills, tags, badges and one-offs below.
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
// A literal 8 or 10 on any corner, outside a comment.
const OFF_SCALE = /^(?!\s*(\/\/|\/?\*)).*\bborder\w*Radius:[^,]*?\b(8|10)\b/

// The radii #2106 left alone, and how many in each file: pills, tags, badges, the 32px
// icon container, the app-logo tile and a 1px divider.
const EXCEPTIONS: Record<string, number> = {
  "app/components/amount-badge/amount-badge.tsx": 1,
  "app/components/atomic/currency-pill/currency-pill.tsx": 1,
  "app/components/atomic/galoy-currency-bubble-text/galoy-currency-bubble-text.tsx": 1,
  "app/components/atomic/galoy-icon-button/galoy-icon-button.tsx": 1,
  "app/components/circle/circle.tsx": 1,
  "app/components/currency-input/currency-input.tsx": 1,
  "app/components/currency-tag/currency-tag.tsx": 1,
  "app/components/map-component/place-sheet.tsx": 1,
  "app/components/wallet-filter-dropdown/wallet-filter-dropdown.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx": 1,
  "app/screens/totp-screen/authenticator-apps-screen.tsx": 1,
}

// The corners #2106 moved to the token, and how many in each file. A corner put back to a
// literal 12 lowers a count, which the guard on 8 and 10 can't see.
const TOKEN_CORNERS: Record<string, number> = {
  "app/components/action-button/action-button.tsx": 1,
  "app/components/action-field/action-field.tsx": 1,
  "app/components/amount-input-screen/amount-input-screen-ui.tsx": 6,
  "app/components/amount-input/amount-input-button.tsx": 1,
  "app/components/atomic/galoy-button-field/galoy-button-field.tsx": 1,
  "app/components/atomic/galoy-error-box/galoy-error-box.tsx": 1,
  "app/components/atomic/galoy-info/galoy-info.tsx": 2,
  "app/components/atomic/galoy-input/galoy-redesigned-input.tsx": 1,
  "app/components/button-group/button-group.tsx": 1,
  "app/components/card-screen/card-action-buttons.tsx": 1,
  "app/components/card-screen/card-balance-section.tsx": 1,
  "app/components/card-screen/card-transactions-section.tsx": 1,
  "app/components/card-screen/dropdown.tsx": 2,
  "app/components/card-screen/info-card.tsx": 1,
  "app/components/card-screen/info-section.tsx": 1,
  "app/components/card-screen/input-field.tsx": 1,
  "app/components/card-screen/multi-line-field.tsx": 1,
  "app/components/card-screen/setting-item-row.tsx": 1,
  "app/components/card-screen/statement-item.tsx": 1,
  "app/components/code-input/code-input.tsx": 1,
  "app/components/currency-keyboard/currency-keyboard.tsx": 1,
  "app/components/expiration-time-chooser/expiration-time-button.tsx": 1,
  "app/components/galoy-toast/galoy-toast.tsx": 1,
  "app/components/icon-text-button/icon-text-button.tsx": 1,
  "app/components/info-banner/info-banner.tsx": 1,
  "app/components/invite-modal/invite-modal.tsx": 1,
  "app/components/june-challenge/card.tsx": 1,
  "app/components/map-component/add-place-panel.tsx": 2,
  "app/components/map-component/place-search-modal.tsx": 1,
  "app/components/may-challenge/card.tsx": 1,
  "app/components/mnemonic-word-input/mnemonic-word-input.tsx": 1,
  "app/components/mnemonic-words-grid/mnemonic-words-grid.tsx": 1,
  "app/components/note-input/note-input.tsx": 1,
  "app/components/notifications/notification-card-ui.tsx": 2,
  "app/components/numeric-keypad/numeric-keypad.tsx": 1,
  "app/components/option-card-group/option-card-group.tsx": 1,
  "app/components/option-selector/option-selector.tsx": 1,
  "app/components/password-input/password-input.tsx": 1,
  "app/components/phone-input/phone-input.tsx": 2,
  "app/components/receive-amount-row/receive-amount-row.tsx": 1,
  "app/components/restricted-region/restricted-region-banner.tsx": 1,
  "app/components/revealed-checkbox-list/revealed-checkbox-list.tsx": 1,
  "app/components/security-score-card/security-score-card.tsx": 1,
  "app/components/set-default-account-modal/set-default-account-modal.tsx": 1,
  "app/components/set-lightning-address-modal/set-lightning-address-modal.tsx": 1,
  "app/components/suggestion-bar/suggestion-bar.tsx": 1,
  "app/components/telegram-login/telegram-button.tsx": 1,
  "app/components/totp-export/totp-copy.tsx": 1,
  "app/components/totp-export/totp-qr.tsx": 1,
  "app/components/unclaimed-deposit-banner/unclaimed-deposit-banner.tsx": 1,
  "app/components/wallet-filter-dropdown/wallet-filter-dropdown.tsx": 1,
  "app/components/wallet-overview/wallet-overview.tsx": 1,
  "app/components/wallet-summary/wallet-summary.tsx": 1,
  "app/components/warning-card/warning-card.tsx": 1,
  "app/components/year-selector/year-selector.tsx": 3,
  "app/screens/account-migration/balance-pair-card.tsx": 1,
  "app/screens/account-migration/to-non-custodial/contact-support-screen.tsx": 1,
  "app/screens/account-migration/to-non-custodial/merchant-tools-screen.tsx": 1,
  "app/screens/account-type-selection/account-type-selection.tsx": 1,
  "app/screens/card-screen/card-fee-schedule-screen.tsx": 3,
  "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx": 3,
  "app/screens/card-screen/card-settings-screen/card-settings-screen.tsx": 1,
  "app/screens/card-screen/card-settings-screen/close-card-modal.tsx": 1,
  "app/screens/card-screen/card-statements-screen/card-statements-screen.tsx": 2,
  "app/screens/card-screen/onboarding/card-flow/card-details-screen.tsx": 1,
  "app/screens/card-screen/onboarding/investment-flow/select-invest-screen.tsx": 1,
  "app/screens/card-screen/onboarding/investment-flow/term-sheet-screen.tsx": 1,
  "app/screens/card-screen/order-card-screens/steps/shared-styles.ts": 1,
  "app/screens/card-screen/order-card-screens/steps/shipping-step.tsx": 1,
  "app/screens/card-screen/pin-screens/card-pin-layout.tsx": 1,
  "app/screens/card-screen/replace-card-screens/steps/shared-styles.ts": 1,
  "app/screens/email-login-screen/email-login-initiate.tsx": 1,
  "app/screens/email-registration-screen/email-registration-initiate.tsx": 1,
  "app/screens/galoy-address-screen/address-component.tsx": 1,
  "app/screens/home-screen/home-screen.tsx": 3,
  "app/screens/lightning-address-screen/set-lightning-address-screen.tsx": 1,
  "app/screens/people-screen/circles/circles-card-people-home.tsx": 1,
  "app/screens/people-screen/circles/invite-friends-card.tsx": 1,
  "app/screens/people-screen/circles/share-circles-card.tsx": 1,
  "app/screens/people-screen/contacts/all-contacts.tsx": 1,
  "app/screens/people-screen/contacts/contacts-card.tsx": 1,
  "app/screens/phone-auth-screen/phone-login-input.tsx": 2,
  "app/screens/phone-auth-screen/phone-login-validation.tsx": 1,
  "app/screens/phone-auth-screen/phone-registration-input.tsx": 2,
  "app/screens/phone-auth-screen/phone-registration-validation.tsx": 1,
  "app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen.tsx": 2,
  "app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen.tsx": 1,
  "app/screens/self-custodial/onboarding/manual-backup/backup-phrase-confirm-screen.tsx": 1,
  "app/screens/self-custodial/onboarding/manual-backup/backup-phrase-screen.tsx": 1,
  "app/screens/send-bitcoin-screen/confirm-destination-modal.tsx": 1,
  "app/screens/send-bitcoin-screen/fee-tier-selector.tsx": 2,
  "app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.tsx": 1,
  "app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx": 2,
  "app/screens/send-bitcoin-screen/send-bitcoin-details-screen.tsx": 3,
  "app/screens/settings-screen/account/settings/delete.tsx": 1,
  "app/screens/settings-screen/api/api-key-create-screen.tsx": 1,
  "app/screens/settings-screen/button.tsx": 2,
  "app/screens/settings-screen/group.tsx": 1,
  "app/screens/settings-screen/security-screen.tsx": 1,
  "app/screens/settings-screen/self-custodial/account-fields.tsx": 1,
  "app/screens/settings-screen/self-custodial/delete-account-confirm-modal.tsx": 1,
  "app/screens/settings-screen/settings-card.tsx": 1,
  "app/screens/totp-screen/authenticator-apps-screen.tsx": 1,
  "app/screens/totp-screen/authenticator-intro-screen.tsx": 1,
  "app/screens/totp-screen/setup-key-backup-screen.tsx": 1,
  "app/screens/transaction-detail-screen/transaction-detail-screen.tsx": 1,
  "app/screens/unclaimed-deposits/unclaimed-deposits-screen.tsx": 3,
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

describe("radius", () => {
  it("rounds the default corner at 12", () => {
    expect(radius.default).toBe(12)
  })

  const flagged = [
    "    borderRadius: 8,",
    "    borderRadius: 10,",
    "    borderTopRightRadius: 8,",
    "      borderRadius: hasSubtitle ? 8 : 0,",
  ]
  flagged.forEach((line) => {
    it(`flags ${line.trim()}`, () => {
      expect(OFF_SCALE.test(line)).toBe(true)
    })
  })

  const allowed = [
    "    borderRadius: radius.default,",
    "    borderRadius: 12,",
    "    borderRadius: 100,",
    "    shadowRadius: 8,",
    "    // borderRadius: 8 was the old default",
  ]
  allowed.forEach((line) => {
    it(`allows ${line.trim()}`, () => {
      expect(OFF_SCALE.test(line)).toBe(false)
    })
  })

  it("uses 8 or 10 only on the documented pills, tags and badges", () => {
    const counts: Record<string, number> = {}
    sourceFiles(APP_DIR).forEach((file) => {
      const hits = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => OFF_SCALE.test(line)).length
      if (hits) counts[relative(REPO_ROOT, file)] = hits
    })

    expect(counts).toEqual(EXCEPTIONS)
  })

  it("keeps every corner moved to the token on it", () => {
    const counts = Object.fromEntries(
      Object.keys(TOKEN_CORNERS).map((file) => [
        file,
        readFileSync(join(REPO_ROOT, file), "utf8").split("radius.default").length - 1,
      ]),
    )

    expect(counts).toEqual(TOKEN_CORNERS)
  })
})
