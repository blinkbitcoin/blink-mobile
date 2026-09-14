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

  it("selfCustodialDollarBalanceBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries)
  })

  it("selfCustodialDollarBalanceBlockedCountries defaults to Hong Kong", () => {
    expect(defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries).toEqual(["HK"])
  })

  it("selfCustodialCreationBlockedCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.selfCustodialCreationBlockedCountries)
  })

  /** The custodial creation block moved to the server's own deny list with blink#756, so
   *  only the self-custodial half is still answered from a compiled-in default. */
  it("the self-custodial creation block defaults to the comprehensively sanctioned regions plus Russia and Belarus", () => {
    expect(defaultRemoteConfig.selfCustodialCreationBlockedCountries).toEqual([
      "CU",
      "IR",
      "KP",
      "SY",
      "RU",
      "BY",
    ])
  })

  it("offboardOnlyCountries contains only uppercase ISO-3166 alpha-2 codes with no duplicates", () => {
    assertCanonical(defaultRemoteConfig.offboardOnlyCountries)
  })

  it("offboardOnlyCountries defaults to the UAE, Nepal, Algeria, China and Myanmar", () => {
    expect(defaultRemoteConfig.offboardOnlyCountries).toEqual([
      "AE",
      "NP",
      "DZ",
      "CN",
      "MM",
    ])
  })

  /** The registered default is what runs before the first fetch lands and on every fetch
   *  that fails; releasing the swap on the server's COMPLETED alone is the #4102 report. */
  it("migrationDelayedRedirectEnabled defaults to holding the swap", () => {
    expect(defaultRemoteConfig.migrationDelayedRedirectEnabled).toBe(false)
  })

  it("migrationReceiveDelayedNoticeMs defaults to the one minute product asked for", () => {
    expect(defaultRemoteConfig.migrationReceiveDelayedNoticeMs).toBe(60_000)
  })
})
