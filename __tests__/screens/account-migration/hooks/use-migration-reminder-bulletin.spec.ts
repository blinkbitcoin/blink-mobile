import { renderHook } from "@testing-library/react-native"

import { useMigrationReminderBulletin } from "@app/screens/account-migration/hooks/use-migration-reminder-bulletin"
import { WindDown, WindDownReason, WindDownStatus } from "@app/types/wind-down"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockAccountType } }),
}))

/** A synthetic affected wind-down; each test swaps `status` on top of it. */
const affectedWindDown: WindDown = {
  status: WindDownStatus.PreCutoff,
  reason: WindDownReason.Region,
  receiveDisabledAt: 1_790_000_000,
  finalDeadline: 1_790_100_000,
  gateArmsAt: 1_790_200_000,
  timezone: "Europe/Paris",
}

let mockStatus: WindDownStatus | null = WindDownStatus.PreCutoff
let mockReason: WindDownReason = WindDownReason.Region

jest.mock("@app/screens/account-migration/hooks/use-wind-down-status", () => ({
  useWindDownStatus: () => ({
    windDown:
      mockStatus === null
        ? null
        : { ...affectedWindDown, status: mockStatus, reason: mockReason },
    isPending: false,
  }),
}))

describe("useMigrationReminderBulletin", () => {
  beforeEach(() => {
    mockAccountType = AccountType.Custodial
    mockStatus = WindDownStatus.PreCutoff
    mockReason = WindDownReason.Region
  })

  it("shows for a custodial account in the pre-cutoff phase with the deadline data", () => {
    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.phase).toBe(WindDownStatus.PreCutoff)
    expect(result.current.deadlineTimestamp).toBe(affectedWindDown.finalDeadline)
    expect(result.current.receiveDisabledTimestamp).toBe(
      affectedWindDown.receiveDisabledAt,
    )
    expect(result.current.timezone).toBe(affectedWindDown.timezone)
    expect(result.current.reason).toBe(WindDownReason.Region)
  })

  it("passes a Level 0 reason through for the trial-account copy", () => {
    mockReason = WindDownReason.LevelZero

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.reason).toBe(WindDownReason.LevelZero)
  })

  /** The migrate-now modal also fires in this phase, but it is dismissible for the session
   *  and leaves the dashboard with no entry into the migration behind it. */
  it("keeps showing once receiving is disabled, reporting that phase", () => {
    mockStatus = WindDownStatus.ReceiveDisabled

    const { result } = renderHook(() => useMigrationReminderBulletin())

    expect(result.current.isVisible).toBe(true)
    expect(result.current.phase).toBe(WindDownStatus.ReceiveDisabled)
    expect(result.current.deadlineTimestamp).toBe(affectedWindDown.finalDeadline)
    expect(result.current.timezone).toBe(affectedWindDown.timezone)
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
