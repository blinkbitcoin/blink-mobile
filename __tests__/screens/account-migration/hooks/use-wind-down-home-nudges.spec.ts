import { renderHook } from "@testing-library/react-native"

import { useWindDownHomeNudges } from "@app/screens/account-migration/hooks/use-wind-down-home-nudges"

const mockMigrateNowPrompt = { isVisible: true, isReceiveDisabled: true }
const mockReminderBulletin = { isVisible: false, deadlineTimestamp: 123, timezone: "UTC" }

jest.mock("@app/screens/account-migration/hooks/use-migrate-now-prompt", () => ({
  useMigrateNowPrompt: () => mockMigrateNowPrompt,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-reminder-bulletin", () => ({
  useMigrationReminderBulletin: () => mockReminderBulletin,
}))

describe("useWindDownHomeNudges", () => {
  it("bundles the migrate-now prompt and the reminder bulletin from one call", () => {
    const { result } = renderHook(() => useWindDownHomeNudges())

    expect(result.current.migrateNowPrompt).toBe(mockMigrateNowPrompt)
    expect(result.current.reminderBulletin).toBe(mockReminderBulletin)
  })
})
