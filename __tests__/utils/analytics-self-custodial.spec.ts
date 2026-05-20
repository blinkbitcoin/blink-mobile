/* eslint-disable camelcase */
import {
  logSelfCustodialBackupCompleted,
  logSelfCustodialRestoreCompleted,
  logSelfCustodialRolloutExposed,
  logSelfCustodialStableBalanceActivated,
} from "@app/utils/analytics"

const mockLogEvent = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

describe("self-custodial analytics helpers (Important #15)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("logSelfCustodialBackupCompleted", () => {
    it("emits 'self_custodial_backup_completed' with snake_case backup_method", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_backup_completed", {
        backup_method: "manual",
      })
    })

    it("propagates each backup method literal verbatim", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "google_drive" })
      logSelfCustodialBackupCompleted({ backupMethod: "icloud" })

      expect(mockLogEvent).toHaveBeenNthCalledWith(1, "self_custodial_backup_completed", {
        backup_method: "google_drive",
      })
      expect(mockLogEvent).toHaveBeenNthCalledWith(2, "self_custodial_backup_completed", {
        backup_method: "icloud",
      })
    })
  })

  describe("logSelfCustodialRestoreCompleted", () => {
    it("emits 'self_custodial_restore_completed' with no payload", () => {
      logSelfCustodialRestoreCompleted()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_restore_completed")
    })
  })

  describe("logSelfCustodialStableBalanceActivated", () => {
    it("emits 'self_custodial_stable_balance_activated' with the label", () => {
      logSelfCustodialStableBalanceActivated({ label: "USD" })

      expect(mockLogEvent).toHaveBeenCalledWith(
        "self_custodial_stable_balance_activated",
        { label: "USD" },
      )
    })
  })

  describe("logSelfCustodialRolloutExposed", () => {
    it("renames camelCase params to snake_case payload keys", () => {
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: true,
        stableBalanceEnabled: false,
        hasCustodialAccount: true,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_rollout_exposed", {
        non_custodial_enabled: true,
        stable_balance_enabled: false,
        has_custodial_account: true,
      })
    })

    it("preserves false booleans (does not coerce to undefined or omit keys)", () => {
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: false,
        stableBalanceEnabled: false,
        hasCustodialAccount: false,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_rollout_exposed", {
        non_custodial_enabled: false,
        stable_balance_enabled: false,
        has_custodial_account: false,
      })
    })
  })
})
