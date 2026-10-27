/* eslint-disable camelcase */
import {
  logSelfCustodialBackupCompleted,
  logSelfCustodialRestoreCompleted,
  logSelfCustodialRolloutExposed,
  logSelfCustodialStableBalanceActivated,
} from "@app/self-custodial/analytics"
import {
  resetMeasurementContext,
  setMeasurementContext,
} from "@app/self-custodial/measurement"
import { AccountMode } from "@app/types/account"

const mockLogEvent = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

describe("self-custodial analytics helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasurementContext()
  })

  describe("gated events", () => {
    it("emit with the network attached when the active account is Enhanced", () => {
      setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })

      logSelfCustodialBackupCompleted({ backupMethod: "manual" })

      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_backup_completed", {
        network: "mainnet",
        backup_method: "manual",
      })
    })

    it("emit nothing when the active account is Incognito or modeless", () => {
      setMeasurementContext({ mode: AccountMode.Anon, network: "mainnet" })
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })
      logSelfCustodialStableBalanceActivated({ label: "USD" })

      setMeasurementContext({ mode: null, network: "mainnet" })
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe("logSelfCustodialBackupCompleted", () => {
    beforeEach(() => {
      setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })
    })

    it("emits 'self_custodial_backup_completed' with snake_case backup_method", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_backup_completed", {
        network: "mainnet",
        backup_method: "manual",
      })
    })

    it("propagates each backup method literal verbatim", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "google_drive" })
      logSelfCustodialBackupCompleted({ backupMethod: "icloud" })

      expect(mockLogEvent).toHaveBeenNthCalledWith(1, "self_custodial_backup_completed", {
        network: "mainnet",
        backup_method: "google_drive",
      })
      expect(mockLogEvent).toHaveBeenNthCalledWith(2, "self_custodial_backup_completed", {
        network: "mainnet",
        backup_method: "icloud",
      })
    })
  })

  describe("logSelfCustodialRestoreCompleted", () => {
    it("emits against the mode the restore established, before activation", () => {
      logSelfCustodialRestoreCompleted(AccountMode.Enhanced)

      expect(mockLogEvent).toHaveBeenCalledWith("self_custodial_restore_completed", {
        network: "mainnet",
      })
    })

    it("emits nothing for an Incognito or unknown-mode restore", () => {
      logSelfCustodialRestoreCompleted(AccountMode.Anon)
      logSelfCustodialRestoreCompleted(null)

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe("logSelfCustodialStableBalanceActivated", () => {
    it("emits 'self_custodial_stable_balance_activated' with the label", () => {
      setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })

      logSelfCustodialStableBalanceActivated({ label: "USD" })

      expect(mockLogEvent).toHaveBeenCalledWith(
        "self_custodial_stable_balance_activated",
        { network: "mainnet", label: "USD" },
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

    it("stays ungated: it measures custodial rollout exposure, not account activity", () => {
      setMeasurementContext({ mode: AccountMode.Anon, network: "mainnet" })

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
