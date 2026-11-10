import { renderHook } from "@testing-library/react-native"

import { useSelfCustodialDisabled } from "@app/screens/account-migration/hooks/use-self-custodial-disabled"

let mockFeatureFlags = {
  nonCustodialEnabled: true,
  remoteConfigReady: true,
  isNonCustodialFlagSettled: true,
}

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useFeatureFlags: () => mockFeatureFlags,
}))

const isDisabled = (): boolean =>
  renderHook(() => useSelfCustodialDisabled()).result.current

describe("useSelfCustodialDisabled", () => {
  it("is not disabled before the remote config has loaded", () => {
    mockFeatureFlags = {
      nonCustodialEnabled: false,
      remoteConfigReady: false,
      isNonCustodialFlagSettled: false,
    }

    expect(isDisabled()).toBe(false)
  })

  it("is not disabled once the console turns self-custodial on", () => {
    mockFeatureFlags = {
      nonCustodialEnabled: true,
      remoteConfigReady: true,
      isNonCustodialFlagSettled: true,
    }

    expect(isDisabled()).toBe(false)
  })

  it("is disabled once the console turns self-custodial off", () => {
    mockFeatureFlags = {
      nonCustodialEnabled: false,
      remoteConfigReady: true,
      isNonCustodialFlagSettled: true,
    }

    expect(isDisabled()).toBe(true)
  })

  it("stays disabled while only the shipped default turns self-custodial on", () => {
    mockFeatureFlags = {
      nonCustodialEnabled: true,
      remoteConfigReady: true,
      isNonCustodialFlagSettled: false,
    }

    expect(isDisabled()).toBe(true)
  })
})
