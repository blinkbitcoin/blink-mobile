import React from "react"
import { act, render } from "@testing-library/react-native"
import { Text } from "react-native"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

import { flushEffects } from "../helpers/flush-effects"

/** One instance with its own state: the provider applies the shipped defaults when the
 *  module loads, before anything in this file has run. */
jest.mock("@react-native-firebase/remote-config", () => {
  const defaults = { fail: (_error: Error) => {} }
  const instance = {
    setDefaults: () =>
      new Promise<void>((_resolve, reject) => {
        defaults.fail = reject
      }),
    setConfigSettings: () => undefined,
    fetchTimeMillis: -1,
    getValue: () => ({
      getSource: () => "static",
      asString: () => "",
      asBoolean: () => false,
      asNumber: () => 0,
    }),
    fetchAndActivate: async () => true,
    failDefaults: (error: Error) => defaults.fail(error),
  }
  return { __esModule: true, default: () => instance }
})

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "NonAuth" }),
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

const FlagsProbe: React.FC = () => {
  const { nonCustodialEnabled } = useFeatureFlags()
  return <Text testID="enabled">{String(nonCustodialEnabled)}</Text>
}

const failShippedDefaults = (error: Error) =>
  (
    remoteConfigInstance() as unknown as { failDefaults: (error: Error) => void }
  ).failDefaults(error)

describe("remote config when the shipped defaults fail to apply", () => {
  it("reports the failure and still shows the app on the shipped defaults", async () => {
    const view = render(
      <FeatureFlagContextProvider>
        <FlagsProbe />
      </FeatureFlagContextProvider>,
    )
    await flushEffects()

    await act(async () => failShippedDefaults(new Error("defaults failed")))
    await flushEffects()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: { stage: "setDefaults" } }),
    )
    expect(view.getByTestId("enabled").props.children).toBe("true")
  })
})
