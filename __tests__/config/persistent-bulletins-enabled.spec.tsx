/**
 * `persistentBulletinsEnabled` decides whether the home honours a bulletin the server
 * marks as not dismissible. Off is the known-good behaviour, every bulletin closable, so
 * the shipped default must stay off, and the remote value must reach the context for the
 * console toggle to mean anything. Tested against the real provider, not a copy of it.
 */
import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const mockRemoteBooleans: { current: Record<string, boolean> } = { current: {} }

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      asString: () => "",
      asBoolean: () => mockRemoteBooleans.current[key] ?? false,
      asNumber: () => 0,
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

const FLAG_KEY = "persistentBulletinsEnabled"
/** A boolean whose remote value differs from its default, to know the fetch landed. */
const SENTINEL_KEY = "btcMapPlacesEnabled"

const FlagProbe: React.FC = () => {
  const { persistentBulletinsEnabled, btcMapPlacesEnabled } = useRemoteConfig()
  return (
    <>
      <Text testID="flag">{String(persistentBulletinsEnabled)}</Text>
      <Text testID="sentinel">{String(btcMapPlacesEnabled)}</Text>
    </>
  )
}

/**
 * The provider starts from the defaults, so the flag reads false before anything was
 * fetched. Waiting for the sentinel to flip proves the remote values committed; only
 * then does the flag's value say what the fetch made of it.
 */
const renderWithRemoteFlag = async (value: boolean): Promise<string> => {
  mockRemoteBooleans.current = { [FLAG_KEY]: value, [SENTINEL_KEY]: false }
  const view = render(
    <FeatureFlagContextProvider>
      <FlagProbe />
    </FeatureFlagContextProvider>,
  )
  await waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe("false")
  })
  return view.getByTestId("flag").props.children
}

describe("persistentBulletinsEnabled remote config", () => {
  it("ships switched off", () => {
    expect(defaultRemoteConfig.persistentBulletinsEnabled).toBe(false)
  })

  it("follows the console when it is switched on", async () => {
    expect(await renderWithRemoteFlag(true)).toBe("true")
  })

  it("stays off when the console leaves it off", async () => {
    expect(await renderWithRemoteFlag(false)).toBe("false")
  })
})
