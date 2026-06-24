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
  it("custodialFirstSignupBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.custodialFirstSignupBlockedCountries)
  })

  it("selfCustodialTransferBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.selfCustodialTransferBlockedCountries)
  })

  it("selfCustodialTransferBlockedCountries defaults to the 27 EU member states", () => {
    expect(defaultRemoteConfig.selfCustodialTransferBlockedCountries).toHaveLength(27)
  })

  it("custodialTransferBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.custodialTransferBlockedCountries)
  })

  it("both account-type transfer blocks default to the same 27 EU member states", () => {
    expect(defaultRemoteConfig.custodialTransferBlockedCountries).toEqual(
      defaultRemoteConfig.selfCustodialTransferBlockedCountries,
    )
    expect(defaultRemoteConfig.custodialTransferBlockedCountries).toHaveLength(27)
  })

  it("selfCustodialDollarBalanceBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries)
  })

  it("selfCustodialDollarBalanceBlockedCountries defaults to Hong Kong", () => {
    expect(defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries).toEqual(["HK"])
  })

  it("custodialCreationBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.custodialCreationBlockedCountries)
  })

  it("selfCustodialCreationBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.selfCustodialCreationBlockedCountries)
  })

  it("creation blocks default to the comprehensively sanctioned regions plus Russia and Belarus, identically for both account types", () => {
    const expected = ["CU", "IR", "KP", "SY", "RU", "BY"]
    expect(defaultRemoteConfig.custodialCreationBlockedCountries).toEqual(expected)
    expect(defaultRemoteConfig.selfCustodialCreationBlockedCountries).toEqual(expected)
  })
})
