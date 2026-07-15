import { renderHook } from "@testing-library/react-native"

import { useMigrationReminderBulletin } from "@app/screens/account-migration/hooks/use-migration-reminder-bulletin"
import { WindDown, WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ accountType: mockAccountType }),
}))

/** A synthetic affected wind-down; each test swaps `status` on top of it. */
const affectedWindDown: WindDown = {
  status: WindDownStatus.PreCutoff,
  receiveDisabledAt: 1_790_000_000,
  finalDeadline: 1_790_100_000,
  gateArmsAt: 1_790_200_000,
  timezone: "Europe/Paris",
}

let mockStatus: WindDownStatus | null = WindDownStatus.PreCutoff

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () =>
    mockStatus === null ? null : { ...affectedWindDown, status: mockStatus },
}))

describe("useMigrationReminderBulletin", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.PreCutoff
  })

  it("shows for a custodial account in the pre-cutoff phase with the deadline data", () => {
    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.deadlineTimestamp).toBe(affectedWindDown.finalDeadline)
    expect(result.current.timezone).toBe(affectedWindDown.timezone)
  })

  it("hides once receiving is disabled, where the migrate-now modal takes over", () => {
    mockStatus = WindDownStatus.ReceiveDisabled

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides once the gate closes, where the blocker takes the whole home", () => {
    mockStatus = WindDownStatus.GatedClosed

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides for an account the wind-down does not affect", () => {
    mockStatus = null

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("never shows for a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(false)
  })
})
