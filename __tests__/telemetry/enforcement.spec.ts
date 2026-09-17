// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import { readdirSync } from "node:fs"
import { resolve } from "node:path"

// No @types/eslint in the dev tree, and adding a dependency for one assertion is not
// worth it: the two methods used here are stable public API.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ESLint } = require("eslint") as {
  ESLint: new (options: { cwd: string }) => {
    calculateConfigForFile: (path: string) => Promise<unknown>
  }
}

/**
 * AD-29: enforcement is committed config, and it is checked as *resolved* config. The
 * `.eslintrc.json` already carries an override that once turned `no-restricted-imports`
 * off for another package; nothing stops a future override doing the same for these two
 * rules except a check that reads what ESLint will actually apply to a file.
 *
 * This runs in the ordinary test job, so it is CI without a workflow change.
 */

const ROOT = resolve(__dirname, "../..")
const eslint = new ESLint({ cwd: ROOT })

type ResolvedRule = [severity: string | number, ...options: unknown[]] | string | number

const severityOf = (rule: ResolvedRule | undefined): string | number | undefined =>
  Array.isArray(rule) ? rule[0] : rule

const bansImportOf = (name: string, rule: ResolvedRule | undefined): boolean => {
  if (!Array.isArray(rule)) return false
  const [, options] = rule as [unknown, { paths?: { name: string }[] } | undefined]
  return Boolean(options?.paths?.some((path) => path.name === name))
}

const bansAnalyticsImport = (rule: ResolvedRule | undefined): boolean =>
  bansImportOf("@react-native-firebase/analytics", rule)

const bansCrashlyticsImport = (rule: ResolvedRule | undefined): boolean =>
  bansImportOf("@react-native-firebase/crashlytics", rule)

const bansCrashCollectionControls = (rule: ResolvedRule | undefined): boolean => {
  if (!Array.isArray(rule)) return false
  const [, ...restrictions] = rule as [unknown, ...{ selector?: string }[]]
  return restrictions.some(
    (restriction) =>
      typeof restriction?.selector === "string" &&
      [
        "setCrashlyticsCollectionEnabled",
        "deleteUnsentReports",
        "sendUnsentReports",
        "setCrashCollectionDisposition",
      ].every((name) => restriction.selector?.includes(name)),
  )
}

const bansIdentityAndCollectionCalls = (rule: ResolvedRule | undefined): boolean => {
  if (!Array.isArray(rule)) return false
  const [, ...restrictions] = rule as [unknown, ...{ selector?: string }[]]
  return restrictions.some(
    (restriction) =>
      typeof restriction?.selector === "string" &&
      [
        "setUserId",
        "setUserProperty",
        "setUserProperties",
        "setAnalyticsCollectionEnabled",
      ].every((name) => restriction.selector?.includes(name)),
  )
}

const sourceFilesUnder = (dir: string): string[] => {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(resolve(ROOT, current), { withFileTypes: true })) {
      const path = `${current}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
        out.push(path)
    }
  }
  walk(dir)
  return out
}

const resolvedRulesFor = async (file: string) => {
  const config = (await eslint.calculateConfigForFile(resolve(ROOT, file))) as {
    rules: Record<string, ResolvedRule>
  }
  return config.rules
}

describe("AD-29 — the two rules hold in the resolved ESLint config", () => {
  const ENFORCED_FILES = [
    "app/screens/home-screen/home-screen.tsx",
    "app/self-custodial/hooks/use-sdk-lifecycle.ts",
    "app/self-custodial/analytics.ts",
    "app/utils/storage/legacy-key-store.ts",
    "app/telemetry/mode.ts",
    "app/telemetry/outbox/drain.ts",
  ]

  it.each(ENFORCED_FILES.map((file) => ({ file })))(
    "bans the analytics import and the identity/collection calls in $file",
    async ({ file }) => {
      const rules = await resolvedRulesFor(file)

      expect(severityOf(rules["no-restricted-imports"])).not.toBe("off")
      expect(severityOf(rules["no-restricted-imports"])).not.toBe(0)
      expect(bansAnalyticsImport(rules["no-restricted-imports"])).toBe(true)
      expect(bansCrashlyticsImport(rules["no-restricted-imports"])).toBe(true)

      expect(severityOf(rules["no-restricted-syntax"])).not.toBe("off")
      expect(severityOf(rules["no-restricted-syntax"])).not.toBe(0)
      expect(bansIdentityAndCollectionCalls(rules["no-restricted-syntax"])).toBe(true)
    },
  )

  /**
   * AD-13 / AD-30: every non-fatal and breadcrumb in the app funnels through one gated
   * sink. The ban is what makes "every error path" a property of the build rather than of
   * a grep — so the exemption list is enumerated here in full, and every other file under
   * `app/` is checked, not a sample. Adding a file to the exemption means changing this
   * list in the same commit, in review.
   */
  const CRASHLYTICS_IMPORTERS = [
    "app/utils/error-reporting.ts",
    "app/telemetry/diagnostics.ts",
  ]

  it("lets Crashlytics be reached from the sink and the boundary's diagnostics only", async () => {
    for (const file of CRASHLYTICS_IMPORTERS) {
      const rules = await resolvedRulesFor(file)
      expect(bansCrashlyticsImport(rules["no-restricted-imports"])).toBe(false)
      expect(bansAnalyticsImport(rules["no-restricted-imports"])).toBe(true)
    }
  })

  it("bans the Crashlytics import from every other file under app/", async () => {
    const files = sourceFilesUnder("app").filter(
      (file) => !CRASHLYTICS_IMPORTERS.includes(file),
    )
    expect(files.length).toBeGreaterThan(1_000)

    const lifted: string[] = []
    for (const file of files) {
      const rules = await resolvedRulesFor(file)
      if (!bansCrashlyticsImport(rules["no-restricted-imports"])) lifted.push(file)
    }

    expect(lifted).toEqual([])
  }, 120_000)

  it("lets crash collection be switched from the sink only, and the sink still cannot touch analytics identity", async () => {
    const sink = await resolvedRulesFor("app/utils/error-reporting.ts")
    expect(bansCrashCollectionControls(sink["no-restricted-syntax"])).toBe(false)
    expect(bansIdentityAndCollectionCalls(sink["no-restricted-syntax"])).toBe(true)

    for (const file of [
      "app/telemetry/diagnostics.ts",
      "app/telemetry/mode.ts",
      "app/screens/developer-screen/developer-screen.tsx",
      "app/self-custodial/logging.ts",
    ]) {
      const rules = await resolvedRulesFor(file)
      expect(bansCrashCollectionControls(rules["no-restricted-syntax"])).toBe(true)
    }
  })

  it("bans it in particular where the second review found direct calls", async () => {
    for (const file of [
      "app/app.tsx",
      "app/graphql/hooks/use-apollo-rebuild-lifecycle.ts",
      "app/screens/developer-screen/developer-screen.tsx",
      "app/screens/people-screen/circles/use-circles-card.tsx",
      "app/screens/send-bitcoin-screen/merchant-selection-screen.tsx",
      "app/screens/send-bitcoin-screen/use-save-lnaddress-contact.ts",
      "app/screens/settings-screen/api/api-key-secret-reveal.tsx",
      "app/self-custodial/logging.ts",
      "app/self-custodial/hooks/use-delete-account.ts",
    ]) {
      const rules = await resolvedRulesFor(file)
      expect(bansCrashlyticsImport(rules["no-restricted-imports"])).toBe(true)
    }
  })

  it("exempts exactly one file from both, and it is the boundary's platform seam", async () => {
    const rules = await resolvedRulesFor("app/telemetry/platform-analytics.ts")

    expect(bansAnalyticsImport(rules["no-restricted-imports"])).toBe(false)
    expect(severityOf(rules["no-restricted-syntax"])).toBe("off")
  })

  it("keeps the legacy call sites on a shrinking allowlist, never a blanket exemption", async () => {
    const rules = await resolvedRulesFor("app/utils/analytics.ts")

    // The import ban is lifted for this file alone (FR-2 backlog) …
    expect(bansAnalyticsImport(rules["no-restricted-imports"])).toBe(false)
    // … but the key-store ban is re-declared rather than the rule being turned off …
    expect(severityOf(rules["no-restricted-imports"])).not.toBe("off")
    // … and the identity/collection ban still applies.
    expect(bansIdentityAndCollectionCalls(rules["no-restricted-syntax"])).toBe(true)
  })
})
