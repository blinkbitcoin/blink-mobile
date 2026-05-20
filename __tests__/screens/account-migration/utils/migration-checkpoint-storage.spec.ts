import { Platform } from "react-native"

import {
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  isExpired,
  loadCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
  validateStoredCheckpoint,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockLoadJson = jest.fn()
const mockSaveJson = jest.fn()
const mockRemove = jest.fn()

jest.mock("@app/utils/storage", () => ({
  loadJson: (...args: readonly unknown[]) => mockLoadJson(...args),
  saveJson: (...args: readonly unknown[]) => mockSaveJson(...args),
  remove: (...args: readonly unknown[]) => mockRemove(...args),
}))

describe("migration-checkpoint-storage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRemove.mockResolvedValue(undefined)
  })

  describe("getStorageKey", () => {
    it("namespaces by environment", () => {
      expect(getStorageKey("Main")).toBe("migrationCheckpoint_main")
      expect(getStorageKey("Staging")).toBe("migrationCheckpoint_staging")
    })
  })

  describe("validateStoredCheckpoint", () => {
    it("returns null for null input", () => {
      expect(validateStoredCheckpoint(null)).toBeNull()
    })

    it("returns null for non-object input", () => {
      expect(validateStoredCheckpoint("string")).toBeNull()
    })

    it("returns null for invalid step", () => {
      expect(validateStoredCheckpoint({ step: "invalid", savedAt: 123 })).toBeNull()
    })

    it("returns null for missing savedAt", () => {
      expect(validateStoredCheckpoint({ step: "backupMethod" })).toBeNull()
    })

    it("returns null for non-number savedAt", () => {
      expect(
        validateStoredCheckpoint({ step: "backupMethod", savedAt: "not-a-number" }),
      ).toBeNull()
    })

    it("returns valid checkpoint", () => {
      const result = validateStoredCheckpoint({ step: "backupMethod", savedAt: 1000 })
      expect(result).toEqual({ step: "backupMethod", savedAt: 1000 })
    })
  })

  describe("isExpired (48h uniform)", () => {
    const now = 1000000000
    const h = 60 * 60 * 1000

    it("not expired at 24h", () => {
      const cp = { step: MigrationCheckpoint.BackupMethod, savedAt: now - 24 * h }
      expect(isExpired(cp, now)).toBe(false)
    })

    it("not expired at 47h", () => {
      const cp = { step: MigrationCheckpoint.CloudBackup, savedAt: now - 47 * h }
      expect(isExpired(cp, now)).toBe(false)
    })

    it("not expired at 1h", () => {
      const cp = { step: MigrationCheckpoint.BackupAlerts, savedAt: now - Number(h) }
      expect(isExpired(cp, now)).toBe(false)
    })

    it("expired at 49h for BackupMethod", () => {
      const cp = { step: MigrationCheckpoint.BackupMethod, savedAt: now - 49 * h }
      expect(isExpired(cp, now)).toBe(true)
    })

    it("expired at 49h for CloudBackup", () => {
      const cp = { step: MigrationCheckpoint.CloudBackup, savedAt: now - 49 * h }
      expect(isExpired(cp, now)).toBe(true)
    })

    it("expired at 49h for BackupAlerts", () => {
      const cp = { step: MigrationCheckpoint.BackupAlerts, savedAt: now - 49 * h }
      expect(isExpired(cp, now)).toBe(true)
    })
  })

  describe("resolveCheckpointRoute", () => {
    it("returns default for null checkpoint", () => {
      expect(resolveCheckpointRoute(null)).toBe("accountMigrationExplainer")
    })

    it("returns correct route for BackupMethod", () => {
      expect(resolveCheckpointRoute(MigrationCheckpoint.BackupMethod)).toBe(
        "selfCustodialBackupMethod",
      )
    })

    it("returns correct route for BackupAlerts", () => {
      expect(resolveCheckpointRoute(MigrationCheckpoint.BackupAlerts)).toBe(
        "selfCustodialBackupSecurityChecks",
      )
    })

    it("returns correct route for CloudBackup on Android", () => {
      const original = Platform.OS
      Object.defineProperty(Platform, "OS", { value: "android" })

      expect(resolveCheckpointRoute(MigrationCheckpoint.CloudBackup)).toBe(
        "selfCustodialCloudBackup",
      )

      Object.defineProperty(Platform, "OS", { value: original })
    })

    it("returns default route for CloudBackup on iOS", () => {
      const original = Platform.OS
      Object.defineProperty(Platform, "OS", { value: "ios" })

      expect(resolveCheckpointRoute(MigrationCheckpoint.CloudBackup)).toBe(
        "accountMigrationExplainer",
      )

      Object.defineProperty(Platform, "OS", { value: original })
    })
  })

  describe("loadCheckpoint", () => {
    it("returns valid non-expired checkpoint", async () => {
      mockLoadJson.mockResolvedValue({
        step: "backupAlerts",
        savedAt: Date.now() - 1000,
      })

      const result = await loadCheckpoint("test-key")
      expect(result).toEqual({
        step: "backupAlerts",
        savedAt: expect.any(Number),
      })
    })

    it("returns null and removes expired checkpoint", async () => {
      mockLoadJson.mockResolvedValue({
        step: "backupMethod",
        savedAt: Date.now() - 49 * 60 * 60 * 1000,
      })

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
      expect(mockRemove).toHaveBeenCalledWith("test-key")
    })

    it("returns null for invalid data", async () => {
      mockLoadJson.mockResolvedValue({ step: "invalid" })

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
    })

    it("clears the key and re-throws on storage error so the caller can report", async () => {
      mockLoadJson.mockRejectedValue(new Error("corrupt"))

      await expect(loadCheckpoint("test-key")).rejects.toThrow("corrupt")
      expect(mockRemove).toHaveBeenCalledWith("test-key")
    })

    it("returns null for null storage", async () => {
      mockLoadJson.mockResolvedValue(null)

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
    })
  })

  describe("saveCheckpointToStorage", () => {
    it("persists step and timestamp", async () => {
      const before = Date.now()
      await saveCheckpointToStorage("test-key", MigrationCheckpoint.BackupAlerts)

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
      })

      const savedAt = mockSaveJson.mock.calls[0][1].savedAt
      expect(savedAt).toBeGreaterThanOrEqual(before)
      expect(savedAt).toBeLessThanOrEqual(Date.now())
    })
  })

  describe("clearCheckpointFromStorage", () => {
    it("removes key from storage", async () => {
      await clearCheckpointFromStorage("test-key")
      expect(mockRemove).toHaveBeenCalledWith("test-key")
    })
  })
})
