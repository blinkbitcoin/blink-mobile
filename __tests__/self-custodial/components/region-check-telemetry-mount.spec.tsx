/* eslint-disable camelcase */
import React from "react"
import { act, render } from "@testing-library/react-native"
import { it } from "@jest/globals"

// React 19 react-test-renderer calls window.dispatchEvent for error
// reporting which doesn't exist in React Native jest environment.
if (typeof window !== "undefined" && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn()
}

import {
  REGION_CHECK_SETTLE_MS,
  RegionCheckTelemetryMount,
} from "@app/self-custodial/components/region-check-telemetry-mount"
import { AccountMode } from "@app/types/account"

const mockMeasureOnce = jest.fn()
let mockGeneration = 1
jest.mock("@app/self-custodial/measurement", () => ({
  ...jest.requireActual("@app/self-custodial/measurement"),
  measureOnce: (...args: unknown[]) => mockMeasureOnce(...args),
  measurementGeneration: () => mockGeneration,
}))

const mockSanctions = {
  isRestrictedRegion: false,
  isRestrictedRegionEvaluationPending: false,
}
jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => mockSanctions,
}))

const mockGates = {
  dollarBalance: false,
  transfer: false,
  isSettled: true,
  isRegionDetermined: true,
}
const mockUseAccountRestrictions = jest.fn(() => mockGates)
jest.mock("@app/hooks/use-account-restrictions", () => ({
  useAccountRestrictions: () => mockUseAccountRestrictions(),
}))

const mockAccount = {
  activeAccountId: "sc-1" as string | null,
  accountMode: AccountMode.Enhanced as AccountMode | null,
}
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => mockAccount,
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => 0,
}))

let mockIpGeneration = 7
const mockIpSubscribers = new Set<() => void>()
jest.mock("@app/utils/ip-country-lookup", () => ({
  getIpCountryLookupGeneration: () => mockIpGeneration,
  subscribeToIpCountryLookup: (onChange: () => void) => {
    mockIpSubscribers.add(onChange)
    return () => mockIpSubscribers.delete(onChange)
  },
}))

const newSession = () => {
  mockIpGeneration += 1
  mockIpSubscribers.forEach((onChange) => onChange())
}

const settle = () =>
  act(() => {
    jest.advanceTimersByTime(REGION_CHECK_SETTLE_MS)
  })

const reported = () =>
  mockMeasureOnce.mock.calls.map(([key, event, params]) => ({ key, event, params }))

describe("RegionCheckTelemetryMount", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockIpSubscribers.clear()
    mockGeneration = 1
    mockIpGeneration = 7
    Object.assign(mockSanctions, {
      isRestrictedRegion: false,
      isRestrictedRegionEvaluationPending: false,
    })
    Object.assign(mockGates, {
      dollarBalance: false,
      transfer: false,
      isSettled: true,
      isRegionDetermined: true,
    })
    Object.assign(mockAccount, {
      activeAccountId: "sc-1",
      accountMode: AccountMode.Enhanced,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each([
    {
      label: "allowed",
      sanctions: {},
      gates: {},
      outcome: "allowed",
      dollar: false,
      transfer: false,
    },
    {
      label: "restricted by sanctions",
      sanctions: { isRestrictedRegion: true },
      gates: {},
      outcome: "restricted",
      dollar: false,
      transfer: false,
    },
    {
      label: "restricted by a gate",
      sanctions: {},
      gates: { transfer: true },
      outcome: "restricted",
      dollar: false,
      transfer: true,
    },
    {
      label: "unknown",
      sanctions: {},
      gates: { isRegionDetermined: false, dollarBalance: true },
      outcome: "unknown",
      dollar: true,
      transfer: false,
    },
  ])("reports a settled $label verdict once, keyed to the session", (row) => {
    Object.assign(mockSanctions, row.sanctions)
    Object.assign(mockGates, row.gates)

    render(<RegionCheckTelemetryMount />)
    settle()

    expect(reported()).toEqual([
      {
        key: "region:1:7",
        event: "sc_region_checked",
        params: {
          region_outcome: row.outcome,
          dollar_balance_restricted: row.dollar,
          transfer_restricted: row.transfer,
        },
      },
    ])
  })

  it("waits for the verdict to hold before reporting it", () => {
    render(<RegionCheckTelemetryMount />)

    act(() => {
      jest.advanceTimersByTime(REGION_CHECK_SETTLE_MS - 1)
    })
    expect(mockMeasureOnce).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(mockMeasureOnce).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      "the sanctions check",
      () => (mockSanctions.isRestrictedRegionEvaluationPending = true),
    ],
    ["the feature gates", () => (mockGates.isSettled = false)],
  ])("reports nothing while %s is pending", (_label, makePending) => {
    makePending()

    render(<RegionCheckTelemetryMount />)
    settle()
    settle()

    expect(mockUseAccountRestrictions).toHaveBeenCalled()
    expect(mockMeasureOnce).not.toHaveBeenCalled()
  })

  it("drops a verdict that goes back to pending before it has held", () => {
    const view = render(<RegionCheckTelemetryMount />)
    act(() => {
      jest.advanceTimersByTime(REGION_CHECK_SETTLE_MS / 2)
    })

    mockGates.isSettled = false
    view.rerender(<RegionCheckTelemetryMount />)
    settle()
    expect(mockMeasureOnce).not.toHaveBeenCalled()

    mockGates.isSettled = true
    mockGates.transfer = true
    view.rerender(<RegionCheckTelemetryMount />)
    settle()

    expect(reported()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({ region_outcome: "restricted" }),
      }),
    ])
  })

  it("does not report the last session's verdict under the new session's key", () => {
    const view = render(<RegionCheckTelemetryMount />)
    settle()
    expect(reported().map(({ key }) => key)).toEqual(["region:1:7"])

    /** The generation moves a commit before the lookup goes back to pending. */
    act(() => newSession())
    mockGates.isSettled = false
    view.rerender(<RegionCheckTelemetryMount />)
    settle()
    expect(mockMeasureOnce).toHaveBeenCalledTimes(1)

    mockGates.isSettled = true
    mockGates.dollarBalance = true
    view.rerender(<RegionCheckTelemetryMount />)
    settle()

    expect(reported()[1]).toEqual({
      key: "region:1:8",
      event: "sc_region_checked",
      params: {
        region_outcome: "restricted",
        dollar_balance_restricted: true,
        transfer_restricted: false,
      },
    })
  })

  it("reports again for a new session with the same verdict", () => {
    render(<RegionCheckTelemetryMount />)
    settle()

    act(() => newSession())
    settle()

    expect(reported().map(({ key }) => key)).toEqual(["region:1:7", "region:1:8"])
  })

  it("reports again for another Enhanced account in the same session", () => {
    const view = render(<RegionCheckTelemetryMount />)
    settle()

    mockAccount.activeAccountId = "sc-2"
    mockGeneration = 2
    view.rerender(<RegionCheckTelemetryMount />)
    settle()

    expect(reported().map(({ key }) => key)).toEqual(["region:1:7", "region:2:7"])
  })

  it("does not report again on a re-render with nothing changed", () => {
    const view = render(<RegionCheckTelemetryMount />)
    settle()

    view.rerender(<RegionCheckTelemetryMount />)
    settle()

    expect(mockMeasureOnce).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["Incognito", AccountMode.Anon],
    ["an unset mode", null],
  ])("does not even evaluate the region in %s", (_label, accountMode) => {
    mockAccount.accountMode = accountMode

    const view = render(<RegionCheckTelemetryMount />)
    settle()

    expect(view.toJSON()).toBeNull()
    expect(mockUseAccountRestrictions).not.toHaveBeenCalled()
    expect(mockMeasureOnce).not.toHaveBeenCalled()
  })

  it("drops a waiting verdict when the account leaves Enhanced", () => {
    const view = render(<RegionCheckTelemetryMount />)
    expect(mockUseAccountRestrictions).toHaveBeenCalled()

    mockAccount.accountMode = AccountMode.Anon
    view.rerender(<RegionCheckTelemetryMount />)
    settle()

    expect(mockMeasureOnce).not.toHaveBeenCalled()
  })
})
