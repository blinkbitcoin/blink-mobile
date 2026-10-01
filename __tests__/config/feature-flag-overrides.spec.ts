import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  applyFlagOverride,
  FlagOverride,
  getFeatureFlagOverrides,
  hydrateFeatureFlagOverrides,
  resetFeatureFlagOverridesForTests,
  setFeatureFlagOverride,
  subscribeToFeatureFlagOverrides,
} from "@app/config/feature-flag-overrides"
import { loadJson } from "@app/utils/storage"

jest.mock("@app/utils/storage", () => ({
  loadJson: jest.fn(async () => null),
  saveJson: jest.fn(async () => undefined),
}))

const mockedLoadJson = loadJson as jest.MockedFunction<typeof loadJson>

describe("applyFlagOverride", () => {
  it("hands the flag back to Remote Config by default", () => {
    expect(applyFlagOverride(true, FlagOverride.Default)).toBe(true)
    expect(applyFlagOverride(false, FlagOverride.Default)).toBe(false)
  })

  it("forces a flag on that Remote Config left off", () => {
    // The emulator case: the fetch failed, so the flag is at its shipped `false`.
    expect(applyFlagOverride(false, FlagOverride.On)).toBe(true)
  })

  it("forces a flag off that Remote Config turned on", () => {
    // The rollback scenario in the rollout doc, and the reason this is not a boolean.
    expect(applyFlagOverride(true, FlagOverride.Off)).toBe(false)
  })
})

describe("the feature flag override store", () => {
  beforeEach(() => {
    resetFeatureFlagOverridesForTests()
    mockedLoadJson.mockReset()
    mockedLoadJson.mockResolvedValue(null)
  })

  it("starts with nothing overridden", () => {
    expect(getFeatureFlagOverrides()).toEqual({
      nonCustodialEnabled: FlagOverride.Default,
      stableBalanceEnabled: FlagOverride.Default,
    })
  })

  it("records one flag without disturbing the other", () => {
    setFeatureFlagOverride({ nonCustodialEnabled: FlagOverride.On })

    expect(getFeatureFlagOverrides()).toEqual({
      nonCustodialEnabled: FlagOverride.On,
      stableBalanceEnabled: FlagOverride.Default,
    })
  })

  it("hydrates a stored override", async () => {
    mockedLoadJson.mockResolvedValue({
      nonCustodialEnabled: FlagOverride.On,
      stableBalanceEnabled: FlagOverride.Off,
    })

    await hydrateFeatureFlagOverrides()

    expect(getFeatureFlagOverrides()).toEqual({
      nonCustodialEnabled: FlagOverride.On,
      stableBalanceEnabled: FlagOverride.Off,
    })
  })

  it("ignores a stored blob whose values it does not recognise", async () => {
    mockedLoadJson.mockResolvedValue({
      nonCustodialEnabled: "maybe",
      stableBalanceEnabled: "off",
    })

    await hydrateFeatureFlagOverrides()

    expect(getFeatureFlagOverrides().nonCustodialEnabled).toBe(FlagOverride.Default)
  })

  it("keeps the snapshot referentially stable while nothing changes", () => {
    const before = getFeatureFlagOverrides()
    setFeatureFlagOverride({ nonCustodialEnabled: FlagOverride.Default })

    // A `useSyncExternalStore` consumer re-renders on a new reference, and this one sits
    // above the whole app.
    expect(getFeatureFlagOverrides()).toBe(before)
  })

  it("returns to the shared empty snapshot when every flag goes back to Remote", () => {
    const before = getFeatureFlagOverrides()
    setFeatureFlagOverride({ nonCustodialEnabled: FlagOverride.Off })
    setFeatureFlagOverride({ nonCustodialEnabled: FlagOverride.Default })

    expect(getFeatureFlagOverrides()).toBe(before)
  })

  it("notifies subscribers on a change and not on a repeat", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToFeatureFlagOverrides(listener)

    setFeatureFlagOverride({ stableBalanceEnabled: FlagOverride.On })
    expect(listener).toHaveBeenCalledTimes(1)

    setFeatureFlagOverride({ stableBalanceEnabled: FlagOverride.On })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it("stays quiet when hydration finds nothing stored", async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToFeatureFlagOverrides(listener)

    await hydrateFeatureFlagOverrides()

    expect(listener).not.toHaveBeenCalled()
    expect(getFeatureFlagOverrides().nonCustodialEnabled).toBe(FlagOverride.Default)
    unsubscribe()
  })
})
