import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"
import * as ts from "typescript"

import { radius } from "@app/rne-theme/radius"

/**
 * Cards, inputs, non-pill buttons, banners, toasts and list rows take their corners from
 * `radius.default` (blink-wip#2106). 8 is deprecated and 10 was an undocumented near-miss,
 * so an 8 or 10 corner — a literal, or a simple const that holds one — is allowed only on
 * the pills, tags, badges and one-offs below. Token counts are radius properties, not
 * string mentions, so a comment or an unused `radius.default` does not satisfy them.
 * The artifact under test is the style source, so source-coupling here is intentional.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const APP_DIR = join(REPO_ROOT, "app")
const RADIUS_PROPERTY = /^border\w*Radius$/

type Binding = "off-scale" | "token" | "popup" | "other"
type Scope = Map<string, Binding>
type RadiusHits = { offScale: number; token: number; popup: number }

const emptyHits = (): RadiusHits => ({ offScale: 0, token: 0, popup: 0 })

const statementsOf = (node: ts.Node): readonly ts.Statement[] | undefined => {
  if (ts.isSourceFile(node) || ts.isModuleBlock(node) || ts.isBlock(node)) {
    return node.statements
  }
  if (ts.isCaseClause(node) || ts.isDefaultClause(node)) return node.statements
  return undefined
}

const unwrap = (expr: ts.Expression): ts.Expression => {
  if (
    ts.isParenthesizedExpression(expr) ||
    ts.isAsExpression(expr) ||
    ts.isSatisfiesExpression(expr) ||
    ts.isNonNullExpression(expr) ||
    ts.isTypeAssertionExpression(expr)
  ) {
    return unwrap(expr.expression)
  }
  return expr
}

const numericBinding = (value: number): Binding =>
  value === 8 || value === 10 ? "off-scale" : "other"

const radiusMember = (expr: ts.PropertyAccessExpression): Binding => {
  if (!ts.isIdentifier(expr.expression) || expr.expression.text !== "radius") {
    return "other"
  }
  if (expr.name.text === "default") return "token"
  if (expr.name.text === "popup") return "popup"
  return "other"
}

const lookup = (name: string, scopes: Scope[]): Binding => {
  for (const scope of [...scopes].reverse()) {
    const found = scope.get(name)
    if (found) return found
  }
  return "other"
}

const directBinding = (expr: ts.Expression): Binding | undefined => {
  const value = unwrap(expr)
  if (ts.isNumericLiteral(value)) return numericBinding(Number(value.text))
  if (ts.isPropertyAccessExpression(value)) {
    const member = radiusMember(value)
    return member === "other" ? undefined : member
  }
  return undefined
}

const variableDeclarations = (node: ts.Node): readonly ts.VariableDeclaration[] =>
  (statementsOf(node) ?? []).flatMap((statement) =>
    ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
  )

const bindBlock = (node: ts.Node, scope: Scope, parents: Scope[]) => {
  const declarations = variableDeclarations(node).filter(
    (
      declaration,
    ): declaration is ts.VariableDeclaration & {
      name: ts.Identifier
      initializer: ts.Expression
    } => ts.isIdentifier(declaration.name) && declaration.initializer !== undefined,
  )
  declarations.forEach((declaration) => {
    const binding = directBinding(declaration.initializer)
    if (binding) scope.set(declaration.name.text, binding)
  })
  declarations.forEach((declaration) => {
    const initializer = unwrap(declaration.initializer)
    if (!ts.isIdentifier(initializer)) return
    scope.set(declaration.name.text, lookup(initializer.text, [...parents, scope]))
  })
}

const resolveExpression = (expr: ts.Expression, scopes: Scope[]): Binding => {
  const value = unwrap(expr)
  if (ts.isNumericLiteral(value)) return numericBinding(Number(value.text))
  if (ts.isIdentifier(value)) return lookup(value.text, scopes)
  if (ts.isPropertyAccessExpression(value)) return radiusMember(value)
  return "other"
}

const isValueJoin = (kind: ts.SyntaxKind) =>
  kind === ts.SyntaxKind.AmpersandAmpersandToken ||
  kind === ts.SyntaxKind.BarBarToken ||
  kind === ts.SyntaxKind.QuestionQuestionToken

const noteRadius = (expr: ts.Expression, scopes: Scope[], hits: RadiusHits) => {
  const value = unwrap(expr)
  if (ts.isConditionalExpression(value)) {
    noteRadius(value.whenTrue, scopes, hits)
    noteRadius(value.whenFalse, scopes, hits)
    return
  }
  if (ts.isBinaryExpression(value) && isValueJoin(value.operatorToken.kind)) {
    noteRadius(value.left, scopes, hits)
    noteRadius(value.right, scopes, hits)
    return
  }
  const binding = resolveExpression(value, scopes)
  if (binding === "off-scale") hits.offScale += 1
  if (binding === "token") hits.token += 1
  if (binding === "popup") hits.popup += 1
}

const propertyName = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}

const visitNode = (node: ts.Node, scopes: Scope[], hits: RadiusHits) => {
  const statements = statementsOf(node)
  if (statements) {
    const scope: Scope = new Map()
    bindBlock(node, scope, scopes)
    const next = [...scopes, scope]
    statements.forEach((statement) => visitNode(statement, next, hits))
    return
  }
  if (ts.isPropertyAssignment(node)) {
    const name = propertyName(node.name)
    if (name !== undefined && RADIUS_PROPERTY.test(name)) {
      noteRadius(node.initializer, scopes, hits)
      return
    }
  }
  ts.forEachChild(node, (child) => visitNode(child, scopes, hits))
}

const scanSource = (source: string): RadiusHits => {
  const file = ts.createSourceFile(
    "radius-policy.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const hits = emptyHits()
  visitNode(file, [], hits)
  return hits
}

const scanFile = (file: string): RadiusHits => scanSource(readFileSync(file, "utf8"))

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
  "app/components/transaction-item/transaction-item.tsx": 2,
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
  "app/screens/card-screen/card-limits-screen/card-limits-screen.tsx": 1,
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
  "app/screens/people-screen/contacts/contact-transactions.tsx": 4,
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

// The centred popups moved to `radius.popup`: `custom-modal` and the modals that copy its
// card. A popup put back to 16 lowers a count.
const POPUP_CORNERS: Record<string, number> = {
  "app/components/custom-modal/custom-modal.tsx": 1,
  "app/components/introducing-circles-modal/introducing-circles-modal.tsx": 1,
  "app/components/invite-modal/invite-modal.tsx": 1,
  "app/components/june-challenge/modal.tsx": 1,
  "app/components/may-challenge/modal.tsx": 1,
  "app/components/set-default-account-modal/set-default-account-modal.tsx": 1,
  "app/components/stablesats-modal/stablesats-modal.tsx": 1,
  "app/screens/galoy-address-screen/address-explainer-modal.tsx": 1,
  "app/screens/galoy-address-screen/paycode-explainer-modal.tsx": 1,
  "app/screens/galoy-address-screen/pos-explainer-modal.tsx": 1,
  "app/screens/send-bitcoin-screen/confirm-destination-modal.tsx": 1,
  "app/screens/send-bitcoin-screen/confirm-fees-modal.tsx": 1,
  "app/screens/settings-screen/account/multi-account/profile.tsx": 1,
  "app/screens/settings-screen/account/settings/delete.tsx": 1,
}

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })

const styleSource = (body: string) => `const styles = { ${body} }`

describe("radius", () => {
  it("rounds the default corner at 12 and a popup at 20", () => {
    expect(radius).toEqual({ default: 12, popup: 20 })
  })

  const flagged = [
    styleSource("borderRadius: 8,"),
    styleSource("borderRadius: 10,"),
    styleSource("borderTopRightRadius: 8,"),
    styleSource("borderRadius: hasSubtitle ? 8 : 0,"),
    "/* rationale */ const styles = { borderRadius: 8 }",
    "const GROUP_RADIUS = 8\nconst styles = { borderTopLeftRadius: GROUP_RADIUS }",
    "const GROUP_RADIUS = 10\nconst styles = { borderRadius: GROUP_RADIUS }",
  ]
  flagged.forEach((source) => {
    it(`flags ${source.replace(/\s+/g, " ").trim()}`, () => {
      expect(scanSource(source).offScale).toBeGreaterThan(0)
    })
  })

  const allowed = [
    styleSource("borderRadius: radius.default,"),
    styleSource("borderRadius: 12,"),
    styleSource("borderRadius: 100,"),
    styleSource("shadowRadius: 8,"),
    "// borderRadius: 8 was the old default",
    "const decoy = radius.default\n// radius.default\nconst styles = { borderRadius: 12 }",
    "/* radius.popup */\nconst note = radius.popup\nconst styles = { borderRadius: 16 }",
  ]
  allowed.forEach((source) => {
    it(`allows ${source.replace(/\s+/g, " ").trim()}`, () => {
      expect(scanSource(source).offScale).toBe(0)
    })
  })

  it("does not count a decoy token next to a literal 12 or 16", () => {
    expect(
      scanSource(
        "const decoy = radius.default\n// radius.popup\nconst styles = { borderRadius: 12, borderTopLeftRadius: 16 }",
      ),
    ).toEqual({ offScale: 0, token: 0, popup: 0 })
  })

  it("counts an alias of the token as a token corner, not an 8", () => {
    expect(
      scanSource(
        "const GROUP_RADIUS = radius.default\nconst styles = { borderTopLeftRadius: GROUP_RADIUS }",
      ),
    ).toEqual({ offScale: 0, token: 1, popup: 0 })
  })

  it("uses 8 or 10 only on the documented pills, tags and badges", () => {
    const counts: Record<string, number> = {}
    sourceFiles(APP_DIR).forEach((file) => {
      const hits = scanFile(file).offScale
      if (hits) counts[relative(REPO_ROOT, file)] = hits
    })

    expect(counts).toEqual(EXCEPTIONS)
  })

  it("keeps every corner moved to the token on it", () => {
    const counts = Object.fromEntries(
      Object.keys(TOKEN_CORNERS).map((file) => [
        file,
        scanFile(join(REPO_ROOT, file)).token,
      ]),
    )

    expect(counts).toEqual(TOKEN_CORNERS)
  })

  it("keeps every popup on the popup radius", () => {
    const counts = Object.fromEntries(
      Object.keys(POPUP_CORNERS).map((file) => [
        file,
        scanFile(join(REPO_ROOT, file)).popup,
      ]),
    )

    expect(counts).toEqual(POPUP_CORNERS)
  })
})
