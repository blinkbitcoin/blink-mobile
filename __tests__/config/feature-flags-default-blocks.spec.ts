/**
 * Recovers the structural shape check that lived in the deleted
 * `custodial-countries.spec.ts`. The 38-country first-signup list is otherwise
 * an untested literal sitting in feature-flags-context.tsx; a stray non-ISO
 * code or duplicate would ship silently.
 */
import { defaultRemoteConfig } from "@app/config/feature-flags-context"

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: jest.fn(() => ({
      asString: () => "",
      asBoolean: () => false,
      asNumber: () => 0,
    })),
    fetchAndActivate: jest.fn().mockResolvedValue(true),
  }),
}))

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "ZERO" }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { id: "Main" } } }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => false,
}))

jest.mock("@app/self-custodial/analytics", () => ({
  logSelfCustodialRolloutExposed: jest.fn(),
}))

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

const ISO_3166_ALPHA2 = /^[A-Z]{2}$/

const assertCanonical = (list: string[]) => {
  for (const code of list) {
    expect(code).toMatch(ISO_3166_ALPHA2)
  }
  expect(new Set(list).size).toBe(list.length)
}

describe("defaultRemoteConfig: compliance country lists", () => {
  it("custodialSignupBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.custodialSignupBlockedCountries)
  })

  it("custodialFirstSignupBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.custodialFirstSignupBlockedCountries)
  })

  it("custodialSignupBlockedCountries always includes US as the baked-in floor", () => {
    expect(defaultRemoteConfig.custodialSignupBlockedCountries).toContain("US")
  })

  it("does not allow a country to appear in both lists (always-block already covers first-signup)", () => {
    const always = new Set(defaultRemoteConfig.custodialSignupBlockedCountries)
    for (const code of defaultRemoteConfig.custodialFirstSignupBlockedCountries) {
      expect(always.has(code)).toBe(false)
    }
  })

  it("stableTokenTransferBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.stableTokenTransferBlockedCountries)
  })

  it("stableTokenTransferBlockedCountries defaults to the 27 EU member states", () => {
    expect(defaultRemoteConfig.stableTokenTransferBlockedCountries).toHaveLength(27)
  })
})
