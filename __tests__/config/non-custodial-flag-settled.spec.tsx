import React from "react"
import { act, render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

/** Where Firebase says the value of each key comes from: "remote" for a value the
 *  console set, activated on an earlier launch; "default" for the shipped one. */
const mockSource = { current: "remote" }
const mockFetch = {
  isHeld: true,
  isFailing: false,
  landedSource: "remote",
  release: () => {},
}

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(async () => undefined),
    setConfigSettings: jest.fn(),
    get fetchTimeMillis() {
      return mockSource.current === "remote" ? 1 : -1
    },
    getValue: () => ({
      getSource: () => mockSource.current,
      asString: () => "",
      asBoolean: () => mockSource.current === "remote",
      asNumber: () => 0,
    }),
    fetchAndActivate: jest.fn(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const settle = () => {
            if (mockFetch.isFailing) return reject(new Error("offline"))
            mockSource.current = mockFetch.landedSource
            return resolve(true)
          }
          mockFetch.release = settle
          if (!mockFetch.isHeld) settle()
        }),
    ),
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

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

const SettledProbe: React.FC = () => {
  const { isNonCustodialFlagSettled, nonCustodialEnabled } = useFeatureFlags()
  return (
    <>
      <Text testID="settled">{String(isNonCustodialFlagSettled)}</Text>
      <Text testID="enabled">{String(nonCustodialEnabled)}</Text>
    </>
  )
}

const renderProbe = () =>
  render(
    <FeatureFlagContextProvider>
      <SettledProbe />
    </FeatureFlagContextProvider>,
  )

const settledShown = (view: ReturnType<typeof render>): string =>
  view.getByTestId("settled").props.children

describe("isNonCustodialFlagSettled", () => {
  beforeEach(() => {
    mockSource.current = "remote"
    mockFetch.isHeld = true
    mockFetch.isFailing = false
    mockFetch.landedSource = "remote"
  })

  /** The console's word from an earlier launch is the device's best knowledge until
   *  this launch's fetch settles, and the prompts act on it from the first frame. */
  it("is settled before the fetch when the console's value was activated on an earlier launch", async () => {
    const view = renderProbe()

    expect(settledShown(view)).toBe("true")
    mockFetch.release()
    await waitFor(() => expect(settledShown(view)).toBe("true"))
  })

  /** Until the shipped defaults land, Firebase reports every key as static, the values it
   *  activated on an earlier launch included: those are read once the defaults are in,
   *  without waiting on the fetch. */
  it("settles from the activated value once the shipped defaults land, before the fetch", async () => {
    mockSource.current = "static"

    const view = renderProbe()
    expect(settledShown(view)).toBe("false")

    mockSource.current = "remote"
    await act(async () => {})

    expect(settledShown(view)).toBe("true")
    expect(view.getByTestId("enabled").props.children).toBe("true")
  })

  /** The shipped default says nothing about what the console set. */
  it("is not settled before the fetch while Firebase holds only the shipped default", async () => {
    mockSource.current = "default"

    const view = renderProbe()

    expect(settledShown(view)).toBe("false")
    mockFetch.release()
    await waitFor(() => expect(settledShown(view)).toBe("true"))
  })

  it("unsettles when the fetch lands without the console value an earlier launch had", async () => {
    mockFetch.landedSource = "default"

    const view = renderProbe()
    await act(async () => {})
    expect(settledShown(view)).toBe("true")
    await act(async () => mockFetch.release())

    expect(settledShown(view)).toBe("false")
  })

  it("stays unsettled when the fetch lands without a console value for the flag", async () => {
    mockSource.current = "default"
    mockFetch.landedSource = "default"

    const view = renderProbe()
    await act(async () => mockFetch.release())

    expect(settledShown(view)).toBe("false")
  })

  it("offers self-custodial while Firebase serves only a default an earlier build left off", async () => {
    mockSource.current = "default"
    mockFetch.isFailing = true

    const view = renderProbe()
    await act(async () => mockFetch.release())

    expect(view.getByTestId("enabled").props.children).toBe("true")
  })

  /** Offline with nothing activated before, the value is still the shipped default. */
  it("stays unsettled when the fetch fails and Firebase holds only the shipped default", async () => {
    mockSource.current = "default"
    mockFetch.isFailing = true

    const view = renderProbe()
    await act(async () => mockFetch.release())

    expect(mockLogError).toHaveBeenCalled()
    expect(settledShown(view)).toBe("false")
  })
})
