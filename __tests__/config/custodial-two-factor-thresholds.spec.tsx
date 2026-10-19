import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"
import remoteConfig from "@react-native-firebase/remote-config"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  defaultTwoFactorThresholds,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const THRESHOLDS_KEY = "custodialTwoFactorThresholds"

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

  /** Firebase stores only strings, so the shipped object goes in as JSON. */
  it("registers the shipped thresholds with Firebase as JSON", () => {
    const setDefaults = remoteConfig().setDefaults as jest.Mock
    const registered = setDefaults.mock.calls.at(0)?.[0] ?? {}

    expect(JSON.parse(registered[THRESHOLDS_KEY])).toEqual(defaultTwoFactorThresholds)
  })

  it("reads the thresholds the console sets, keeping the shipped ones it leaves out", async () => {
    mockThresholdsJson.current = '{"recommendedSats":400000,"enforcedUsdCents":300000}'

    expect(await readThresholds()).toEqual({
      ...defaultTwoFactorThresholds,
      recommendedSats: 400_000,
      enforcedUsdCents: 300_000,
    })
  })

  /** A zero would put every balance over the threshold. */
  it("keeps the shipped value of a threshold the console sets to zero or below", async () => {
    mockThresholdsJson.current = '{"suggestedSats":0,"recommendedUsdCents":-5}'

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
    expect(mockLogError).toHaveBeenCalled()
  })

  it("reads the shipped thresholds while Firebase holds only static values", async () => {
    mockSource.current = "static"
    mockThresholdsJson.current = '{"recommendedSats":400000}'

    expect(await readThresholds()).toEqual(defaultTwoFactorThresholds)
  })
})
