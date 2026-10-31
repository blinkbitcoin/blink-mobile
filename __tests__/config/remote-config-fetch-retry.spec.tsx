import React from "react"
import { act, render } from "@testing-library/react-native"
import { AppStateStatus, Text } from "react-native"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

import { flushEffects } from "../helpers/flush-effects"

const mockConsole = {
  isActivated: false,
  reportsFetchTime: true,
  hasFlag: true,
  nonCustodialEnabled: true,
  stableBalanceEnabled: false,
}
const mockFetchOutcomes: Array<"fail" | "succeed"> = []
const mockLevel = { current: "NonAuth" }
const mockAppStateListeners: Array<(state: AppStateStatus) => void> = []

const mockFetchAndActivate = jest.fn(async () => {
  if (mockFetchOutcomes.shift() !== "succeed") throw new Error("offline")
  mockConsole.isActivated = true
  return true
})

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(async () => undefined),
    setConfigSettings: jest.fn(),
    get fetchTimeMillis() {
      return mockConsole.isActivated && mockConsole.reportsFetchTime ? 1 : -1
    },
    getValue: (key: string) => {
      const isStableBalanceKey = key === "stableBalanceEnabled"
      const isNonCustodialFromConsole =
        mockConsole.isActivated && mockConsole.hasFlag && key === "nonCustodialEnabled"
      const isStableBalanceFromConsole = mockConsole.isActivated && isStableBalanceKey
      const isConsoleValue = isNonCustodialFromConsole || isStableBalanceFromConsole
      return {
        getSource: () => (isConsoleValue ? "remote" : "static"),
        asString: () => "",
        asBoolean: () =>
          isStableBalanceKey
            ? mockConsole.stableBalanceEnabled
            : mockConsole.nonCustodialEnabled,
        asNumber: () => 0,
      }
    },
    fetchAndActivate: () => mockFetchAndActivate(),
  }),
}))

jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    currentState: "active",
    addEventListener: (_event: string, handler: (state: AppStateStatus) => void) => {
      mockAppStateListeners.push(handler)
      return {
        remove: () => {
          const index = mockAppStateListeners.indexOf(handler)
          if (index !== -1) mockAppStateListeners.splice(index, 1)
        },
      }
    },
  },
}))

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

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

const probeRenders = { count: 0 }

const FlagsProbe: React.FC = () => {
  const { isNonCustodialFlagSettled, nonCustodialEnabled, stableBalanceEnabled } =
    useFeatureFlags()
  probeRenders.count += 1
  return (
    <>
      <Text testID="settled">{String(isNonCustodialFlagSettled)}</Text>
      <Text testID="enabled">{String(nonCustodialEnabled)}</Text>
      <Text testID="stable">{String(stableBalanceEnabled)}</Text>
    </>
  )
}

const renderProbe = () =>
  render(
    <FeatureFlagContextProvider>
      <FlagsProbe />
    </FeatureFlagContextProvider>,
  )

const shown = (view: ReturnType<typeof render>, testID: string): string =>
  view.getByTestId(testID).props.children

const advanceToNextFetch = async (ms: number) => {
  act(() => jest.advanceTimersByTime(ms))
  await flushEffects()
}

const changeAppState = async (state: AppStateStatus) => {
  act(() => mockAppStateListeners.forEach((listener) => listener(state)))
  await flushEffects()
}

const returnToApp = async () => {
  await changeAppState("background")
  await changeAppState("active")
}

describe("remote config fetch retry", () => {
  beforeEach(() => {
    mockConsole.isActivated = false
    mockConsole.reportsFetchTime = true
    mockConsole.hasFlag = true
    mockConsole.nonCustodialEnabled = true
    mockConsole.stableBalanceEnabled = false
    mockFetchOutcomes.length = 0
    mockFetchAndActivate.mockClear()
    mockLogError.mockClear()
    mockLevel.current = "NonAuth"
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("offers self-custodial on a first launch that cannot reach Firebase", async () => {
    mockFetchOutcomes.push("fail")

    const view = renderProbe()
    await flushEffects()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: { stage: "fetchAndActivate" } }),
    )
    expect(shown(view, "enabled")).toBe("true")
    expect(shown(view, "settled")).toBe("false")
  })

  it("asks again after a failed fetch, waiting twice as long each time", async () => {
    mockFetchOutcomes.push("fail", "fail", "fail")

    renderProbe()
    await flushEffects()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)

    await advanceToNextFetch(1_999)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
    await advanceToNextFetch(1)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)

    await advanceToNextFetch(3_999)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
    await advanceToNextFetch(1)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(3)
  })

  it("never waits more than a minute between fetches", async () => {
    mockFetchOutcomes.push("fail", "fail", "fail", "fail", "fail", "fail", "fail")

    renderProbe()
    await flushEffects()
    for (const delayMs of [2_000, 4_000, 8_000, 16_000, 32_000]) {
      await advanceToNextFetch(delayMs)
    }
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(6)

    await advanceToNextFetch(59_999)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(6)
    await advanceToNextFetch(1)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(7)
  })

  it("stops asking after about a quarter of an hour", async () => {
    mockFetchOutcomes.push(...Array<"fail">(25).fill("fail"))

    renderProbe()
    await flushEffects()
    for (const delayMs of [2_000, 4_000, 8_000, 16_000, 32_000]) {
      await advanceToNextFetch(delayMs)
    }
    for (let minute = 0; minute < 14; minute += 1) {
      await advanceToNextFetch(60_000)
    }
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(20)

    await advanceToNextFetch(10 * 60_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(20)
  })

  it("applies the console's value once a retry lands, and stops asking", async () => {
    mockConsole.nonCustodialEnabled = false
    mockFetchOutcomes.push("fail", "succeed")

    const view = renderProbe()
    await flushEffects()
    expect(shown(view, "enabled")).toBe("true")

    await advanceToNextFetch(2_000)

    expect(shown(view, "enabled")).toBe("false")
    expect(shown(view, "settled")).toBe("true")

    await advanceToNextFetch(120_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("stops asking once the provider unmounts", async () => {
    mockFetchOutcomes.push("fail", "fail")

    const view = renderProbe()
    await flushEffects()
    view.unmount()

    await advanceToNextFetch(60_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
    expect(mockAppStateListeners).toHaveLength(0)
  })

  it("does not ask again when a fetch in flight fails after the provider unmounts", async () => {
    const heldFetch = { reject: (_error: Error) => {} }
    mockFetchAndActivate.mockImplementationOnce(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          heldFetch.reject = reject
        }),
    )

    const view = renderProbe()
    view.unmount()
    heldFetch.reject(new Error("offline"))
    await flushEffects()

    await advanceToNextFetch(60_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask again when the first fetch lands", async () => {
    mockFetchOutcomes.push("succeed")

    renderProbe()
    await flushEffects()

    await advanceToNextFetch(120_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask again when a fetch lands without a console value for the flag", async () => {
    mockConsole.hasFlag = false
    mockFetchOutcomes.push("succeed")

    const view = renderProbe()
    await flushEffects()
    expect(shown(view, "settled")).toBe("false")

    await advanceToNextFetch(120_000)
    await returnToApp()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("turns stable balance on once the console turns both flags on", async () => {
    mockConsole.stableBalanceEnabled = true
    mockFetchOutcomes.push("succeed")

    const view = renderProbe()
    await flushEffects()

    expect(shown(view, "stable")).toBe("true")
  })

  it("keeps stable balance off while only the shipped default turns self-custodial on", async () => {
    mockConsole.hasFlag = false
    mockConsole.stableBalanceEnabled = true
    mockFetchOutcomes.push("succeed")

    const view = renderProbe()
    await flushEffects()

    expect(shown(view, "enabled")).toBe("true")
    expect(shown(view, "stable")).toBe("false")
  })

  it("asks at once when the app returns to the foreground while still waiting", async () => {
    mockFetchOutcomes.push("fail", "fail")

    renderProbe()
    await flushEffects()
    await returnToApp()

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("does not ask again once a fetch made on return lands", async () => {
    mockFetchOutcomes.push("fail", "succeed")

    renderProbe()
    await flushEffects()
    await returnToApp()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)

    await advanceToNextFetch(120_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("does not start a second fetch when a retry falls due during one made on return", async () => {
    mockFetchOutcomes.push("fail")

    renderProbe()
    await flushEffects()
    mockFetchAndActivate.mockImplementationOnce(() => new Promise<boolean>(() => {}))
    await returnToApp()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)

    await advanceToNextFetch(2_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("asks when the app returns from the background through an inactive moment", async () => {
    mockFetchOutcomes.push("fail", "fail")

    renderProbe()
    await flushEffects()
    await changeAppState("background")
    await changeAppState("inactive")
    await changeAppState("active")

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("does not ask on return once a fetch landed, even before its time is known", async () => {
    mockConsole.reportsFetchTime = false
    mockFetchOutcomes.push("succeed")

    renderProbe()
    await flushEffects()
    await returnToApp()

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask when the app leaves the background for anything but the foreground", async () => {
    mockFetchOutcomes.push("fail", "fail")

    renderProbe()
    await flushEffects()
    await changeAppState("background")
    await changeAppState("unknown")

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask when the app comes back from an inactive moment", async () => {
    mockFetchOutcomes.push("fail", "fail")

    renderProbe()
    await flushEffects()
    await changeAppState("inactive")
    await changeAppState("active")

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("asks once on return after the retries ran out, without restarting the waits", async () => {
    mockFetchOutcomes.push(...Array<"fail">(25).fill("fail"))

    renderProbe()
    await flushEffects()
    for (const delayMs of [2_000, 4_000, 8_000, 16_000, 32_000]) {
      await advanceToNextFetch(delayMs)
    }
    for (let minute = 0; minute < 14; minute += 1) {
      await advanceToNextFetch(60_000)
    }
    await advanceToNextFetch(10 * 60_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(20)

    await returnToApp()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(21)

    await advanceToNextFetch(10 * 60_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(21)
  })

  it("does not ask on return once the console has answered", async () => {
    mockFetchOutcomes.push("succeed")

    renderProbe()
    await flushEffects()
    await returnToApp()

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask on return while a retry is in flight", async () => {
    mockFetchOutcomes.push("fail")

    renderProbe()
    await flushEffects()
    mockFetchAndActivate.mockImplementationOnce(() => new Promise<boolean>(() => {}))
    await advanceToNextFetch(2_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)

    await returnToApp()

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
  })

  it("does not ask again when an earlier launch fetched without a console value for the flag", async () => {
    mockConsole.isActivated = true
    mockConsole.hasFlag = false
    mockFetchOutcomes.push("fail")

    const view = renderProbe()
    await flushEffects()
    expect(shown(view, "settled")).toBe("false")

    await advanceToNextFetch(120_000)
    await returnToApp()
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("does not ask again when the console's values were activated on an earlier launch", async () => {
    mockConsole.isActivated = true
    mockFetchOutcomes.push("fail")

    const view = renderProbe()
    await flushEffects()
    expect(shown(view, "settled")).toBe("true")

    await advanceToNextFetch(120_000)
    expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("reports the failure once per launch, not on every retry", async () => {
    mockFetchOutcomes.push("fail", "fail", "fail")

    renderProbe()
    await flushEffects()
    await advanceToNextFetch(2_000)
    await advanceToNextFetch(4_000)

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(3)
    expect(mockLogError).toHaveBeenCalledTimes(1)
  })

  it("does not re-render the tree on a retry that fails", async () => {
    mockFetchOutcomes.push("fail", "fail")

    renderProbe()
    await flushEffects()
    const rendersAfterFirstFetch = probeRenders.count

    await advanceToNextFetch(2_000)

    expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
    expect(probeRenders.count).toBe(rendersAfterFirstFetch)
  })
})
