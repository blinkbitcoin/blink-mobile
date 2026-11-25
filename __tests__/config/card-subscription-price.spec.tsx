/**
 * `cardSubscriptionPriceUsd` of 0 is the free offer, which also changes the legal notice
 * the user accepts. `asNumber()` yields 0 for an empty or malformed console value, so
 * the reader has to tell a real 0 from a broken one; tested against the real provider.
 */
import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const mockAsString = jest.fn()
const mockAsNumber = jest.fn()

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      getSource: () => "remote",
      asString: () => mockAsString(key),
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

const PRICE_KEY = "cardSubscriptionPriceUsd"
const SENTINEL_KEY = "backupNudgeModalThreshold"
const SENTINEL_VALUE = 999

const PriceProbe: React.FC = () => {
  const { cardSubscriptionPriceUsd, backupNudgeModalThreshold } = useRemoteConfig()
  return (
    <>
      <Text testID="price">{String(cardSubscriptionPriceUsd)}</Text>
      <Text testID="sentinel">{String(backupNudgeModalThreshold)}</Text>
    </>
  )
}

const renderWithRemotePrice = (raw: string) => {
  mockAsString.mockImplementation((key: string) => (key === PRICE_KEY ? raw : ""))
  mockAsNumber.mockImplementation((key: string) => {
    if (key === SENTINEL_KEY) return SENTINEL_VALUE
    if (key === PRICE_KEY) return Number(raw) || 0
    return 0
  })

  return render(
    <FeatureFlagContextProvider>
      <PriceProbe />
    </FeatureFlagContextProvider>,
  )
}

/** The provider starts from `defaultRemoteConfig`, so the price is only read after the
 *  sentinel proves the remote values landed. */
const expectPriceAfterCommit = async (
  view: ReturnType<typeof render>,
  expected: number,
): Promise<void> => {
  await waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe(String(SENTINEL_VALUE))
  })
  expect(view.getByTestId("price").props.children).toBe(String(expected))
}

describe("cardSubscriptionPriceUsd remote config", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses a price set in the console", async () => {
    await expectPriceAfterCommit(renderWithRemotePrice("250"), 250)
  })

  it("takes an explicit 0 as the free offer", async () => {
    await expectPriceAfterCommit(renderWithRemotePrice("0"), 0)
  })

  it("keeps the shipped price for an empty value", async () => {
    await expectPriceAfterCommit(
      renderWithRemotePrice(""),
      defaultRemoteConfig.cardSubscriptionPriceUsd,
    )
  })

  it("keeps the shipped price for a value that is not a number", async () => {
    await expectPriceAfterCommit(
      renderWithRemotePrice("1000 USD"),
      defaultRemoteConfig.cardSubscriptionPriceUsd,
    )
  })
})
