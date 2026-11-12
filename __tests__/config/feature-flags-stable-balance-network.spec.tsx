import React from "react"
import remoteConfig from "@react-native-firebase/remote-config"
import { renderHook, waitFor } from "@testing-library/react-native"

import {
  FeatureFlagContextProvider,
  useFeatureFlags,
} from "@app/config/feature-flags-context"

let mockInstanceId = "Main"
jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { id: mockInstanceId } } }),
}))

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "ONE" }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => false,
}))

jest.mock("@app/self-custodial/analytics", () => ({
  logSelfCustodialRolloutExposed: jest.fn(),
}))

let mockRegtestToken: string | undefined
jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "mainnet-token",
  get SPARK_REGTEST_TOKEN_IDENTIFIER() {
    return mockRegtestToken
  },
}))

const ENABLED_KEYS = new Set(["nonCustodialEnabled", "stableBalanceEnabled"])
const getValue = remoteConfig().getValue as jest.Mock
const shippedGetValue = getValue.getMockImplementation()!

const readStableBalanceEnabled = async (): Promise<boolean> => {
  const { result } = renderHook(() => useFeatureFlags(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <FeatureFlagContextProvider>{children}</FeatureFlagContextProvider>
    ),
  })
  await waitFor(() => expect(result.current.remoteConfigReady).toBe(true))
  return result.current.stableBalanceEnabled
}

/** The console turns Stable Balance on for every instance; a network without a dollar
 *  token has no Stable Balance in the SDK to turn on. */
describe("stableBalanceEnabled per network", () => {
  beforeEach(() => {
    getValue.mockImplementation((key: string) => {
      const shipped = shippedGetValue(key)
      return ENABLED_KEYS.has(key) ? { ...shipped, asBoolean: () => true } : shipped
    })
    mockRegtestToken = undefined
  })

  afterEach(() => {
    getValue.mockImplementation(shippedGetValue)
  })

  it("follows the console on Main", async () => {
    mockInstanceId = "Main"

    await expect(readStableBalanceEnabled()).resolves.toBe(true)
  })

  it("is off on Staging, whose network has no dollar token", async () => {
    mockInstanceId = "Staging"

    await expect(readStableBalanceEnabled()).resolves.toBe(false)
  })

  it("follows the console on Staging when the build names a regtest token", async () => {
    mockInstanceId = "Staging"
    mockRegtestToken = "btknrt1-test"

    await expect(readStableBalanceEnabled()).resolves.toBe(true)
  })
})
