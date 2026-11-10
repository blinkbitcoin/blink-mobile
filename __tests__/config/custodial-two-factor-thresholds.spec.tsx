import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"
import remoteConfig from "@react-native-firebase/remote-config"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  defaultTwoFactorConsoleThresholds,
  defaultTwoFactorThresholds,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const THRESHOLDS_KEY = "custodialTwoFactorThresholds"

/** A whole set as the console writes it: the shipped one. */
const CONSOLE_SET = {
  suggestedSats: 50_000,
  suggestedUsd: 50,
  recommendedSats: 500_000,
  recommendedUsd: 500,
  enforcedSats: 5_000_000,
  enforcedUsd: 5_000,
}

/** What the console holds for the thresholds key, as Firebase hands it back. */
const mockThresholdsJson: { current: string } = { current: "" }
/** Where Firebase says each value comes from: "static" before the shipped defaults are
 *  applied. */
const mockSource = { current: "remote" }
jest.mock("@react-native-firebase/remote-config", () => {
  /** One instance, as Firebase has: what the module registers when it loads is still
   *  there for the test to read. */
  const instance = {
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      getSource: () => mockSource.current,
      /** A static value is Firebase's empty placeholder, whatever the console holds. */
      asString: () => {
        const isStatic = mockSource.current === "static"
        const isThresholdsKey = key === THRESHOLDS_KEY
        return isThresholdsKey && !isStatic ? mockThresholdsJson.current : ""
      },
      asBoolean: () => false,
      asNumber: () => 0,
    }),
    fetchAndActivate: jest.fn(async () => true),
  }
  return { __esModule: true, default: () => instance }
})

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

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

const ThresholdsProbe: React.FC = () => {
  const { custodialTwoFactorThresholds } = useRemoteConfig()
  return <Text testID="thresholds">{JSON.stringify(custodialTwoFactorThresholds)}</Text>
}

const readThresholds = async () => {
  const view = render(
    <FeatureFlagContextProvider>
      <ThresholdsProbe />
    </FeatureFlagContextProvider>,
  )
  let shown: unknown
  await waitFor(() => {
    shown = JSON.parse(view.getByTestId("thresholds").props.children)
    expect(shown).toBeDefined()
  })
  return shown
}

describe("custodialTwoFactorThresholds remote config", () => {
  beforeEach(() => {
    mockThresholdsJson.current = ""
    mockSource.current = "remote"
    mockLogError.mockClear()
  })

  it("ships 50,000 sats or $50, 500,000 sats or $500, and 5,000,000 sats or $5,000", () => {
    expect(defaultTwoFactorConsoleThresholds).toEqual({
      suggestedSats: 50_000,
      suggestedUsd: 50,
      recommendedSats: 500_000,
      recommendedUsd: 500,
      enforcedSats: 5_000_000,
      enforcedUsd: 5_000,
    })
    expect(defaultTwoFactorThresholds).toEqual({
      suggestedSats: 50_000,
      suggestedUsdCents: 5_000,
      recommendedSats: 500_000,
      recommendedUsdCents: 50_000,
      enforcedSats: 5_000_000,
      enforcedUsdCents: 500_000,
    })
    expect(defaultRemoteConfig.custodialTwoFactorThresholds).toBe(
      defaultTwoFactorThresholds,
    )
  })

  /** Firebase stores only strings, so the shipped object goes in as JSON, in the units
   *  the console writes. */
  it("registers the shipped thresholds with Firebase as JSON, dollars whole", () => {
    const setDefaults = remoteConfig().setDefaults as jest.Mock
    const registered = setDefaults.mock.calls.at(0)?.[0] ?? {}

    expect(JSON.parse(registered[THRESHOLDS_KEY])).toEqual(
      defaultTwoFactorConsoleThresholds,
    )
  })

  /** A fetch that never answers must not hold what waits on it for a minute. */
  it("gives up on a fetch after ten seconds", () => {
    const setConfigSettings = remoteConfig().setConfigSettings as jest.Mock

    expect(setConfigSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fetchTimeMillis: 10_000 }),
    )
  })

  it("reads the thresholds the console sets, its dollars as cents", async () => {
    mockThresholdsJson.current = JSON.stringify({
      ...CONSOLE_SET,
      recommendedSats: 400_000,
      enforcedUsd: 3_000,
    })

    expect(await readThresholds()).toEqual({
      ...defaultTwoFactorThresholds,
      recommendedSats: 400_000,
      enforcedUsdCents: 300_000,
    })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  /** Filling the gap with a shipped value would mix two sets that nobody wrote. */
  it("keeps the shipped thresholds as a whole when the console's leave one out", async () => {
    mockThresholdsJson.current = '{"recommendedSats":400000}'

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "remote-config",
        context: expect.objectContaining({ key: THRESHOLDS_KEY }),
      }),
    )
  })

  it("keeps the shipped thresholds as a whole when a key is misspelled", async () => {
    const { enforcedUsd, ...rest } = CONSOLE_SET
    mockThresholdsJson.current = JSON.stringify({
      ...rest,
      enforcedUSD: enforcedUsd,
    })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
    expect(mockLogError).toHaveBeenCalled()
  })

  /** Read as dollars, the cents rise tier by tier like any set: only the bounds catch
   *  them, before every account above $50 is raised to the enforced tier for good. */
  it("keeps the shipped thresholds when the console writes cents for dollars", async () => {
    mockThresholdsJson.current = JSON.stringify({
      ...CONSOLE_SET,
      suggestedUsd: 5_000,
      recommendedUsd: 50_000,
      enforcedUsd: 500_000,
    })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
    expect(mockLogError).toHaveBeenCalled()
  })

  /** A zero would put every balance over the threshold. */
  it("keeps the shipped thresholds when one is zero or below", async () => {
    mockThresholdsJson.current = JSON.stringify({ ...CONSOLE_SET, suggestedSats: 0 })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
    expect(mockLogError).toHaveBeenCalled()
  })

  /** A tier reached never lowers, so a typo that puts a higher tier below a lower one
   *  would keep accounts escalated after the console is fixed. */
  it("keeps the shipped thresholds when the console's do not rise tier by tier", async () => {
    mockThresholdsJson.current = JSON.stringify({
      ...CONSOLE_SET,
      enforcedSats: 400_000,
    })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
  })

  it("keeps the shipped thresholds when the dollars are not whole", async () => {
    mockThresholdsJson.current = JSON.stringify({
      ...CONSOLE_SET,
      enforcedUsd: 2_500.5,
    })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
  })

  it("reads the shipped thresholds while Firebase holds only static values", async () => {
    mockSource.current = "static"
    mockThresholdsJson.current = JSON.stringify({
      ...CONSOLE_SET,
      recommendedSats: 400_000,
    })

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
  })
})
