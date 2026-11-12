import React from "react"
import { act, render } from "@testing-library/react-native"
import { Text } from "react-native"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

import { flushEffects } from "../helpers/flush-effects"

const mockFetchAndActivate = jest.fn(async () => {
  throw new Error("offline")
})
const mockLevel = { current: "ZERO" }

/** One instance with its own state: the provider applies the shipped defaults when the
 *  module loads, before anything in this file has run. */
jest.mock("@react-native-firebase/remote-config", () => {
  const defaults = { haveLanded: false, land: () => {} }
  const earlierFetch = { isKnown: false }
  const instance = {
    setDefaults: () =>
      new Promise<void>((resolve) => {
        defaults.land = () => {
          defaults.haveLanded = true
          resolve()
        }
      }),
    setConfigSettings: () => undefined,
    get fetchTimeMillis() {
      return defaults.haveLanded || earlierFetch.isKnown ? 1 : -1
    },
    getValue: () => ({
      getSource: () =>
        defaults.haveLanded || earlierFetch.isKnown ? "remote" : "static",
      asString: () => "",
      asBoolean: () => true,
      asNumber: () => 0,
    }),
    fetchAndActivate: () => mockFetchAndActivate(),
    landDefaults: () => defaults.land(),
    revealEarlierFetch: (isKnown: boolean) => {
      earlierFetch.isKnown = isKnown
    },
  }
  return { __esModule: true, default: () => instance }
})

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: mockLevel.current }),
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
  const { isNonCustodialFlagSettled } = useFeatureFlags()
  return <Text testID="settled">{String(isNonCustodialFlagSettled)}</Text>
}

type MockInstance = {
  landDefaults: () => void
  revealEarlierFetch: (isKnown: boolean) => void
}

const landShippedDefaults = () =>
  (remoteConfigInstance() as unknown as MockInstance).landDefaults()

const revealEarlierFetch = (isKnown: boolean) =>
  (remoteConfigInstance() as unknown as MockInstance).revealEarlierFetch(isKnown)

const renderProbe = () =>
  render(
    <FeatureFlagContextProvider>
      <FlagsProbe />
    </FeatureFlagContextProvider>,
  )

describe("remote config fetch retry before the shipped defaults land", () => {
  beforeEach(() => {
    mockFetchAndActivate.mockClear()
    mockLevel.current = "ZERO"
    revealEarlierFetch(false)
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows the app once the wait for them runs out", async () => {
    mockLevel.current = "NonAuth"

    const view = renderProbe()
    await flushEffects()
    expect(view.queryByTestId("settled")).toBeNull()

    act(() => jest.advanceTimersByTime(1_000))
    await flushEffects()

    expect(view.getByTestId("settled").props.children).toBe("false")
  })

  it("reads an earlier fetch that shows up after the wait ran out instead of asking", async () => {
    const view = renderProbe()
    await flushEffects()
    act(() => jest.advanceTimersByTime(1_000))
    await flushEffects()
    expect(view.getByTestId("settled").props.children).toBe("false")

    revealEarlierFetch(true)
    act(() => jest.advanceTimersByTime(2_000))
    await flushEffects()

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
    expect(view.getByTestId("settled").props.children).toBe("true")
  })

  it("waits for them to tell whether the console already answered on an earlier launch", async () => {
    const view = renderProbe()
    await flushEffects()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)

    landShippedDefaults()
    await flushEffects()
    expect(view.getByTestId("settled").props.children).toBe("true")

    act(() => jest.advanceTimersByTime(60_000))
    await flushEffects()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })
})
