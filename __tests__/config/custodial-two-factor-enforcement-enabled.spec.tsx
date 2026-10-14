import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

/** What Firebase holds before this launch's fetch: the previous fetch's activated values. */
const mockActivatedBooleans: { current: Record<string, boolean> } = { current: {} }
/** What this launch's fetch brings down. */
const mockRemoteBooleans: { current: Record<string, boolean> } = { current: {} }
const mockFetch = { isDone: false }

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      asString: () => "",
      asBoolean: () =>
        (mockFetch.isDone ? mockRemoteBooleans.current : mockActivatedBooleans.current)[
          key
        ] ?? false,
      asNumber: () => 0,
    }),
    fetchAndActivate: jest.fn(async () => {
      mockFetch.isDone = true
      return true
    }),
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

const FLAG_KEY = "custodialTwoFactorEnforcementEnabled"
/** A boolean the fetch flips from its activated value, to know the fetch landed. */
const SENTINEL_KEY = "btcMapPlacesEnabled"

const FlagProbe: React.FC = () => {
  const { custodialTwoFactorEnforcementEnabled, btcMapPlacesEnabled } = useRemoteConfig()
  return (
    <>
      <Text testID="flag">{String(custodialTwoFactorEnforcementEnabled)}</Text>
      <Text testID="sentinel">{String(btcMapPlacesEnabled)}</Text>
    </>
  )
}

const renderProbe = () =>
  render(
    <FeatureFlagContextProvider>
      <FlagProbe />
    </FeatureFlagContextProvider>,
  )

const flagShown = (view: ReturnType<typeof render>): string =>
  view.getByTestId("flag").props.children

const whenFetched = (view: ReturnType<typeof render>) =>
  waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe("false")
  })

const renderWithRemoteFlag = async (value: boolean): Promise<string> => {
  mockRemoteBooleans.current = { [FLAG_KEY]: value, [SENTINEL_KEY]: false }
  const view = renderProbe()
  await whenFetched(view)
  return flagShown(view)
}

describe("custodialTwoFactorEnforcementEnabled remote config", () => {
  beforeEach(() => {
    mockFetch.isDone = false
    mockActivatedBooleans.current = { [SENTINEL_KEY]: true }
  })

  it("ships switched off", () => {
    expect(defaultRemoteConfig.custodialTwoFactorEnforcementEnabled).toBe(false)
  })

  it("follows the console when it is switched on", async () => {
    expect(await renderWithRemoteFlag(true)).toBe("true")
  })

  it("stays off when the console leaves it off", async () => {
    expect(await renderWithRemoteFlag(false)).toBe("false")
  })

  it("applies the value Firebase already activated from the first render, before the fetch lands", async () => {
    mockActivatedBooleans.current = { [FLAG_KEY]: true, [SENTINEL_KEY]: true }
    mockRemoteBooleans.current = { [FLAG_KEY]: true, [SENTINEL_KEY]: false }

    const view = renderProbe()

    expect(flagShown(view)).toBe("true")
    expect(view.getByTestId("sentinel").props.children).toBe("true")
    await whenFetched(view)
    expect(flagShown(view)).toBe("true")
  })

  it("lets the fetch replace the activated value", async () => {
    mockActivatedBooleans.current = { [FLAG_KEY]: true, [SENTINEL_KEY]: true }
    mockRemoteBooleans.current = { [FLAG_KEY]: false, [SENTINEL_KEY]: false }

    const view = renderProbe()

    expect(flagShown(view)).toBe("true")
    await whenFetched(view)
    expect(flagShown(view)).toBe("false")
  })
})
