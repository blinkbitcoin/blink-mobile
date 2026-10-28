/**
 * Rollback is a safety control, so it must not fail open on a launch whose Remote Config
 * fetch fails. Firebase keeps what an earlier fetch activated, and the provider reads it
 * whatever the fetch does; `non-custodial-flag-settled.spec.tsx` pins when the flag counts
 * as the console's. What this pins is the two self-custody rollout values the branch reads
 * — the rollback value and the telemetry ramp — surviving a failed fetch, against the real
 * provider rather than a copy of it.
 */
import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

const mockFetchAndActivate = jest.fn()
const mockSources: Record<string, "remote" | "default" | "static"> = {}
const mockBooleans: Record<string, boolean> = {}

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      asString: () => "",
      asNumber: () => 0,
      asBoolean: () => mockBooleans[key] ?? false,
      getSource: () => mockSources[key] ?? "default",
    }),
    fetchAndActivate: () => mockFetchAndActivate(),
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

const FlagsProbe: React.FC = () => {
  const {
    remoteConfigReady,
    isNonCustodialFlagSettled,
    nonCustodialEnabled,
    telemetryEnabled,
  } = useFeatureFlags()
  return (
    <Text testID="flags">
      {JSON.stringify({
        remoteConfigReady,
        isNonCustodialFlagSettled,
        nonCustodialEnabled,
        telemetryEnabled,
      })}
    </Text>
  )
}

const settledFlags = async () => {
  const view = render(
    <FeatureFlagContextProvider>
      <FlagsProbe />
    </FeatureFlagContextProvider>,
  )
  let flags: Record<string, boolean> = {}
  await waitFor(() => {
    flags = JSON.parse(view.getByTestId("flags").props.children)
    expect(flags.remoteConfigReady).toBe(true)
  })
  return flags
}

describe("the self-custody rollout when this launch's fetch fails", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(mockSources)) delete mockSources[key]
    for (const key of Object.keys(mockBooleans)) delete mockBooleans[key]
    mockFetchAndActivate.mockRejectedValue(new Error("fetch throttled"))
  })

  it("trusts a rollback an earlier fetch activated, so it still happens", async () => {
    mockSources.nonCustodialEnabled = "remote"
    mockBooleans.nonCustodialEnabled = false

    expect(await settledFlags()).toMatchObject({
      isNonCustodialFlagSettled: true,
      nonCustodialEnabled: false,
    })
  })

  it("applies the activated rollout values, not the shipped defaults", async () => {
    mockSources.nonCustodialEnabled = "remote"
    mockBooleans.nonCustodialEnabled = true
    mockBooleans.telemetryEnabled = true

    expect(await settledFlags()).toMatchObject({
      isNonCustodialFlagSettled: true,
      nonCustodialEnabled: true,
      telemetryEnabled: true,
    })
  })
})
