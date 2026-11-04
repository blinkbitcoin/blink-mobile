/**
 * `cloudBundleStaleAfterMs` decides how long the cloud copy of the emergency bundle may
 * trail the one on the device before the home says so. `asNumber()` yields 0 for a
 * missing or malformed remote value, and a zero lag would call every upload in flight
 * stale, so the fallback to the shipped week is tested against the real provider.
 */
import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const mockAsNumber = jest.fn()

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      getSource: () => "remote",
      asString: () => "",
      asBoolean: () => false,
      asNumber: () => mockAsNumber(key),
    }),
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

const STALE_AFTER_KEY = "cloudBundleStaleAfterMs"
const SENTINEL_KEY = "backupNudgeModalThreshold"
/** Any value that is not the shipped default for the sentinel key. */
const SENTINEL_VALUE = 999
const ONE_DAY_MS = 24 * 60 * 60 * 1000

const StaleAfterProbe: React.FC = () => {
  const { cloudBundleStaleAfterMs, backupNudgeModalThreshold } = useRemoteConfig()
  return (
    <>
      <Text testID="stale-after">{String(cloudBundleStaleAfterMs)}</Text>
      <Text testID="sentinel">{String(backupNudgeModalThreshold)}</Text>
    </>
  )
}

/**
 * The provider starts from `defaultRemoteConfig`, so the shipped week reads back before
 * anything was fetched. Waiting for the sentinel proves the remote values committed;
 * only then does the lag say what the fetch made of it.
 */
const staleAfterFromRemote = async (value: number): Promise<string> => {
  mockAsNumber.mockImplementation((key: string) => {
    if (key === STALE_AFTER_KEY) return value
    if (key === SENTINEL_KEY) return SENTINEL_VALUE
    return 0
  })
  const view = render(
    <FeatureFlagContextProvider>
      <StaleAfterProbe />
    </FeatureFlagContextProvider>,
  )
  await waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe(String(SENTINEL_VALUE))
  })
  return view.getByTestId("stale-after").props.children
}

describe("cloudBundleStaleAfterMs remote config", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("ships a week", () => {
    expect(defaultRemoteConfig.cloudBundleStaleAfterMs).toBe(7 * ONE_DAY_MS)
  })

  it("follows the console", async () => {
    expect(await staleAfterFromRemote(ONE_DAY_MS)).toBe(String(ONE_DAY_MS))
  })

  it("keeps the shipped week when the console value is 0", async () => {
    expect(await staleAfterFromRemote(0)).toBe(
      String(defaultRemoteConfig.cloudBundleStaleAfterMs),
    )
  })
})
