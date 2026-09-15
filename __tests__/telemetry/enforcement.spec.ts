// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

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

const bansAnalyticsImport = (rule: ResolvedRule | undefined): boolean => {
  if (!Array.isArray(rule)) return false
  const [, options] = rule as [unknown, { paths?: { name: string }[] } | undefined]
  return Boolean(
    options?.paths?.some((path) => path.name === "@react-native-firebase/analytics"),
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

      expect(severityOf(rules["no-restricted-syntax"])).not.toBe("off")
      expect(severityOf(rules["no-restricted-syntax"])).not.toBe(0)
      expect(bansIdentityAndCollectionCalls(rules["no-restricted-syntax"])).toBe(true)
    },
  )

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
