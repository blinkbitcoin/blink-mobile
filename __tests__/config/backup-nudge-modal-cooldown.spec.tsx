/**
 * `backupNudgeModalCooldownMs` decides how long the blocking "Secure your funds"
 * modal stays dismissed. `asNumber()` yields 0 for a missing or malformed remote
 * value, and a zero cooldown makes the modal undismissable again - the exact bug
 * #4156 reports. The guard that falls back to the shipped default is therefore
 * load-bearing and tested here against the real provider, not a copy of it.
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

const COOLDOWN_KEY = "backupNudgeModalCooldownMs"
const SENTINEL_KEY = "backupNudgeModalThreshold"
// Any value that is not the shipped default for the sentinel key.
const SENTINEL_VALUE = 999

const CooldownProbe: React.FC = () => {
  const { backupNudgeModalCooldownMs, backupNudgeModalThreshold } = useRemoteConfig()
  return (
    <>
      <Text testID="cooldown">{String(backupNudgeModalCooldownMs)}</Text>
      <Text testID="sentinel">{String(backupNudgeModalThreshold)}</Text>
    </>
  )
}

// Returns this render's own queries. Querying the global `screen` instead lets a
// previous test's still-mounted provider answer, which hid a real failure here.
const renderWithRemoteCooldown = (value: number) => {
  mockAsNumber.mockImplementation((key: string) => {
    if (key === COOLDOWN_KEY) return value
    if (key === SENTINEL_KEY) return SENTINEL_VALUE
    return 0
  })

  return render(
    <FeatureFlagContextProvider>
      <CooldownProbe />
    </FeatureFlagContextProvider>,
  )
}

/**
 * The provider's initial state IS `defaultRemoteConfig`, so asserting "equals the
 * default" straight after render passes before the async fetch has committed
 * anything - it would hold even with the fallback deleted. Waiting for the
 * sentinel to arrive proves the remote values landed first; only then does the
 * cooldown assertion mean the fallback actually chose the default.
 */
const expectCooldownAfterCommit = async (
  view: ReturnType<typeof render>,
  expected: number,
): Promise<void> => {
  await waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe(String(SENTINEL_VALUE))
  })
  expect(view.getByTestId("cooldown").props.children).toBe(String(expected))
}

describe("backupNudgeModalCooldownMs remote config", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Proves the remote value reaches the context at all. Without this the
  // fallback assertions below would also pass if the provider silently kept its
  // defaults, so this case is what makes the rest of the suite meaningful.
  it("uses a positive remote value", async () => {
    await expectCooldownAfterCommit(renderWithRemoteCooldown(60_000), 60_000)
  })

  it("falls back to the shipped default when the remote value is 0", async () => {
    await expectCooldownAfterCommit(
      renderWithRemoteCooldown(0),
      defaultRemoteConfig.backupNudgeModalCooldownMs,
    )
  })

  it("falls back to the shipped default when the remote value is negative", async () => {
    await expectCooldownAfterCommit(
      renderWithRemoteCooldown(-1),
      defaultRemoteConfig.backupNudgeModalCooldownMs,
    )
  })

  it("ships a 24h default", () => {
    expect(defaultRemoteConfig.backupNudgeModalCooldownMs).toBe(24 * 60 * 60 * 1000)
  })
})
