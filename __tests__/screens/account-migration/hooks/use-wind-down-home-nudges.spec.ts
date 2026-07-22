import { renderHook } from "@testing-library/react-native"

import { useWindDownHomeNudges } from "@app/screens/account-migration/hooks/use-wind-down-home-nudges"

const mockReopen = jest.fn()
const mockMigrateNowPrompt = {
  isVisible: true,
  canReopen: true,
  reopen: mockReopen,
}
const mockReminderBulletin = { isVisible: false, deadlineTimestamp: 123, timezone: "UTC" }
let mockReceiveBlocked = false
const mockToastShow = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-migrate-now-prompt", () => ({
  useMigrateNowPrompt: () => mockMigrateNowPrompt,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-reminder-bulletin", () => ({
  useMigrationReminderBulletin: () => mockReminderBulletin,
}))

jest.mock("@app/screens/account-migration/hooks/use-wind-down-receive-blocked", () => ({
  useWindDownReceiveBlocked: () => mockReceiveBlocked,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { AccountMigration: { receivingDisabledToast: () => "receiving disabled" } },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useWindDownHomeNudges", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMigrateNowPrompt.canReopen = true
    mockReceiveBlocked = false
  })

  it("bundles the migrate-now prompt and the reminder bulletin from one call", () => {
    const { result } = renderHook(() => useWindDownHomeNudges())

    expect(result.current.migrateNowPrompt).toBe(mockMigrateNowPrompt)
    expect(result.current.reminderBulletin).toBe(mockReminderBulletin)
  })

  it("greys Receive whenever the wind-down blocks receiving", () => {
    mockReceiveBlocked = true

    const { result } = renderHook(() => useWindDownHomeNudges())

    expect(result.current.receiveBlocked.isBlocked).toBe(true)
  })

  it("reopens the migrate-now nudge on a blocked tap when the prompt can reopen", () => {
    mockReceiveBlocked = true
    mockMigrateNowPrompt.canReopen = true

    const { result } = renderHook(() => useWindDownHomeNudges())
    result.current.receiveBlocked.onDisabledPress()

    expect(mockReopen).toHaveBeenCalledTimes(1)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("explains with a toast on a blocked tap when the prompt cannot reopen", () => {
    mockReceiveBlocked = true
    mockMigrateNowPrompt.canReopen = false

    const { result } = renderHook(() => useWindDownHomeNudges())
    result.current.receiveBlocked.onDisabledPress()

    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockReopen).not.toHaveBeenCalled()

    const { message } = mockToastShow.mock.calls[0][0]
    expect(
      message({ AccountMigration: { receivingDisabledToast: () => "receiving off" } }),
    ).toBe("receiving off")
  })
})
