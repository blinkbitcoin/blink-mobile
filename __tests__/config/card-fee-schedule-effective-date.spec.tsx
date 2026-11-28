/**
 * `cardFeeScheduleEffectiveDate` is printed on the fee schedule. Only a calendar date such
 * as 2026-07-01 is taken from the console; anything else keeps the shipped date, so the
 * screen never shows a malformed one. Tested against the real provider.
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

const DATE_KEY = "cardFeeScheduleEffectiveDate"
const SENTINEL_KEY = "backupNudgeModalThreshold"
const SENTINEL_VALUE = 999

const DateProbe: React.FC = () => {
  const { cardFeeScheduleEffectiveDate, backupNudgeModalThreshold } = useRemoteConfig()
  return (
    <>
      <Text testID="date">{cardFeeScheduleEffectiveDate}</Text>
      <Text testID="sentinel">{String(backupNudgeModalThreshold)}</Text>
    </>
  )
}

const renderWithRemoteDate = (raw: string) => {
  mockAsString.mockImplementation((key: string) => (key === DATE_KEY ? raw : ""))
  mockAsNumber.mockImplementation((key: string) =>
    key === SENTINEL_KEY ? SENTINEL_VALUE : 0,
  )

  return render(
    <FeatureFlagContextProvider>
      <DateProbe />
    </FeatureFlagContextProvider>,
  )
}

/** The provider starts from `defaultRemoteConfig`, so the date is only read after the
 *  sentinel proves the remote values landed. */
const expectDateAfterCommit = async (
  view: ReturnType<typeof render>,
  expected: string,
): Promise<void> => {
  await waitFor(() => {
    expect(view.getByTestId("sentinel").props.children).toBe(String(SENTINEL_VALUE))
  })
  expect(view.getByTestId("date").props.children).toBe(expected)
}

describe("cardFeeScheduleEffectiveDate remote config", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uses a calendar date set in the console", async () => {
    await expectDateAfterCommit(renderWithRemoteDate("2026-09-15"), "2026-09-15")
  })

  it("reads past spaces around the date", async () => {
    await expectDateAfterCommit(renderWithRemoteDate(" 2026-09-15 "), "2026-09-15")
  })

  it("keeps the shipped date for an empty value", async () => {
    await expectDateAfterCommit(
      renderWithRemoteDate(""),
      defaultRemoteConfig.cardFeeScheduleEffectiveDate,
    )
  })

  it("keeps the shipped date for a date written another way", async () => {
    await expectDateAfterCommit(
      renderWithRemoteDate("July 1, 2026"),
      defaultRemoteConfig.cardFeeScheduleEffectiveDate,
    )
  })

  it("keeps the shipped date for a month that does not exist", async () => {
    await expectDateAfterCommit(
      renderWithRemoteDate("2026-13-01"),
      defaultRemoteConfig.cardFeeScheduleEffectiveDate,
    )
  })

  it("keeps the shipped date for a day the month does not have", async () => {
    await expectDateAfterCommit(
      renderWithRemoteDate("2026-02-30"),
      defaultRemoteConfig.cardFeeScheduleEffectiveDate,
    )
  })
})
