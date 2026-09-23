import {
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  isCommitPointCheckpoint,
  loadCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
  getPendingAccountsStorageKey,
  loadPendingProvisionedAccounts,
  savePendingProvisionedAccount,
  clearPendingProvisionedAccount,
  validateStoredCheckpoint,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockLoadJsonOrThrow = jest.fn()
const mockSaveJson = jest.fn()
const mockRemove = jest.fn()

jest.mock("@app/utils/storage", () => ({
  loadJsonOrThrow: (...args: readonly unknown[]) => mockLoadJsonOrThrow(...args),
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

  describe("validateStoredCheckpoint accountId type", () => {
    it("rejects a stored checkpoint whose accountId is not a string", () => {
      expect(
        validateStoredCheckpoint({
          step: MigrationCheckpoint.BackupMethod,
          savedAt: Date.now(),
          accountId: 123,
        }),
      ).toBeNull()
    })

    it("rejects a stored checkpoint whose custodialAccountId is not a string", () => {
      expect(
        validateStoredCheckpoint({
          step: MigrationCheckpoint.BackupMethod,
          savedAt: Date.now(),
          custodialAccountId: 123,
        }),
      ).toBeNull()
    })
  })

  describe("validateStoredCheckpoint expectedReceiveSats", () => {
    it("keeps a stored number", () => {
      const result = validateStoredCheckpoint({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        expectedReceiveSats: 21000,
      })
      expect(result?.expectedReceiveSats).toBe(21000)
    })

    it("drops a non-number value but keeps the rest of the record", () => {
      const result = validateStoredCheckpoint({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: "21000",
      })

      expect(result).toEqual({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: undefined,
      })
    })

    it("drops a non-finite value but keeps the rest of the record", () => {
      const result = validateStoredCheckpoint({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        accountId: "sc-1",
        expectedReceiveSats: Number.NaN,
      })

      expect(result?.accountId).toBe("sc-1")
      expect(result?.expectedReceiveSats).toBeUndefined()
    })

    /** Checkpoints saved by app versions before the field existed must stay valid: their
     *  absence is what the receive gate reads as "expectation unknown". */
    it("accepts a legacy record without the field", () => {
      const result = validateStoredCheckpoint({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        accountId: "sc-1",
      })
      expect(result).toEqual({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1000,
        accountId: "sc-1",
      })
    })
  })

  describe("resolveCheckpointRoute", () => {
    const preCommitCheckpoints = [
      MigrationCheckpoint.TermsAndConditions,
      MigrationCheckpoint.BackupMethod,
      MigrationCheckpoint.CloudBackup,
      MigrationCheckpoint.BackupAlerts,
    ]

    it("returns the default destination for a null checkpoint", () => {
      expect(resolveCheckpointRoute(null)).toEqual({
        name: "accountMigrationExplainer",
      })
    })

    it("restarts at the explainer for every checkpoint before the commit point", () => {
      for (const checkpoint of preCommitCheckpoints) {
        expect(resolveCheckpointRoute(checkpoint)).toEqual({
          name: "accountMigrationExplainer",
        })
      }
    })

    it("returns the balances-overview destination for the commit point", () => {
      expect(resolveCheckpointRoute(MigrationCheckpoint.BalancesOverview)).toEqual({
        name: "accountMigrationBalancesOverview",
      })
    })

    /** The gate reaches the rest of the flow through this resolver, so a checkpoint that
     *  resolves back to the gate leaves the user cycling between the two with no way
     *  forward. No stored step, present or future, may name it. */
    it("never resolves to the migration gate", () => {
      const everyDestination = [null, ...Object.values(MigrationCheckpoint)].map(
        (checkpoint) => resolveCheckpointRoute(checkpoint).name,
      )

      expect(everyDestination).not.toContain("accountMigrationStart")
    })
  })

  describe("isCommitPointCheckpoint", () => {
    it("holds only for the balances overview", () => {
      const commitPointByCheckpoint = Object.values(MigrationCheckpoint).map(
        (checkpoint) => [checkpoint, isCommitPointCheckpoint(checkpoint)] as const,
      )

      expect(commitPointByCheckpoint).toEqual([
        [MigrationCheckpoint.TermsAndConditions, false],
        [MigrationCheckpoint.BackupMethod, false],
        [MigrationCheckpoint.CloudBackup, false],
        [MigrationCheckpoint.BackupAlerts, false],
        [MigrationCheckpoint.ChooseExperience, false],
        [MigrationCheckpoint.BalancesOverview, true],
      ])
    })

    it("does not hold without a checkpoint", () => {
      expect(isCommitPointCheckpoint(null)).toBe(false)
    })

    /** The mode screen sits before the commit point, so it restarts at the explainer like
     *  every other pre-commit step rather than resuming onto itself. */
    it("restarts the mode checkpoint at the explainer", () => {
      expect(resolveCheckpointRoute(MigrationCheckpoint.ChooseExperience)).toEqual({
        name: "accountMigrationExplainer",
      })
    })
  })

  describe("loadCheckpoint", () => {
    it("returns the stored checkpoint", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: "backupAlerts",
        savedAt: Date.now() - 1000,
      })

      const result = await loadCheckpoint("test-key")
      expect(result).toEqual({
        step: "backupAlerts",
        savedAt: expect.any(Number),
      })
    })

    it("keeps an old record, since only the server can retire a migration", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        accountId: "sc-1",
      })

      const result = await loadCheckpoint("test-key")

      expect(result).toMatchObject({ accountId: "sc-1" })
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it("returns null for invalid data", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({ step: "invalid" })

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
    })

    it("re-throws on storage error so the caller can tell it from an empty store", async () => {
      mockLoadJsonOrThrow.mockRejectedValue(new Error("corrupt"))

      await expect(loadCheckpoint("test-key")).rejects.toThrow("corrupt")
    })

    it("leaves the record alone when the read fails", async () => {
      mockLoadJsonOrThrow.mockRejectedValue(new Error("corrupt"))

      await expect(loadCheckpoint("test-key")).rejects.toThrow("corrupt")
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it("returns null for null storage", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(null)

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
    })
  })

  describe("saveCheckpointToStorage", () => {
    it("persists step and timestamp", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(null)
      const before = Date.now()
      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
      })

      const savedAt = mockSaveJson.mock.calls[0][1].savedAt
      expect(savedAt).toBeGreaterThanOrEqual(before)
      expect(savedAt).toBeLessThanOrEqual(Date.now())
    })

    it("stores the provided account id and custodial owner", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(null)
      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupMethod,
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupMethod,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })
    })

    it("preserves an existing account id across step updates by the same owner", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BackupMethod,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })
    })

    it("drops the previous owner's account id when another account starts a flow", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BackupMethod,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        custodialAccountId: "cust-2",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        savedAt: expect.any(Number),
        accountId: undefined,
        custodialAccountId: "cust-2",
      })
    })

    it("claims an ownerless record without dropping its account id", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BackupMethod,
        savedAt: Date.now(),
        accountId: "sc-1",
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        custodialAccountId: "cust-2",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-2",
      })
    })

    it("stores the expected receive amount alongside the step", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(null)
      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })
    })

    it("preserves the expected receive amount across step updates by the same owner", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })
    })

    /** The #4102 regression: the commit screen is re-enterable after the drain, and the
     *  preview it re-reads then answers 0 for an already emptied balance. */
    it("keeps the stored expected receive amount when a later save carries a post-drain zero", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 0,
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })
    })

    it("keeps the stored expected receive amount when a later save carries a different figure", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 500,
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ expectedReceiveSats: 21000 }),
      )
    })

    it("takes the new owner's expected receive amount over the previous owner's", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-2",
        expectedReceiveSats: 700,
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({
          custodialAccountId: "cust-2",
          expectedReceiveSats: 700,
        }),
      )
    })

    it("drops the previous owner's expected amount when another account starts a flow", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now(),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
        expectedReceiveSats: 21000,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        custodialAccountId: "cust-2",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        savedAt: expect.any(Number),
        accountId: undefined,
        custodialAccountId: "cust-2",
        expectedReceiveSats: undefined,
      })
    })

    it("refuses to save when the previous checkpoint cannot be read", async () => {
      mockLoadJsonOrThrow.mockRejectedValue(new Error("read failed"))

      await expect(
        saveCheckpointToStorage("test-key", { step: MigrationCheckpoint.BackupAlerts }),
      ).rejects.toThrow("read failed")
    })

    it("writes nothing over a record it could not read", async () => {
      mockLoadJsonOrThrow.mockRejectedValue(new Error("read failed"))

      await expect(
        saveCheckpointToStorage("test-key", { step: MigrationCheckpoint.BackupAlerts }),
      ).rejects.toThrow("read failed")
      expect(mockSaveJson).not.toHaveBeenCalled()
    })

    it("lends an old record's account id to the fresh save, so the wallet is reused", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BackupMethod,
        savedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
        accountId: "sc-1",
        custodialAccountId: "cust-1",
      })
    })
  })

  describe("a run that starts over", () => {
    /** The only way back behind the commit point: the flow never walks backwards on its
     *  own, so a step regression is a restart and its predecessor's figures are stale. */
    const priorRun = {
      step: MigrationCheckpoint.BalancesOverview,
      savedAt: Date.now(),
      accountId: "sc-1",
      custodialAccountId: "cust-1",
      expectedReceiveSats: 36726,
    }

    it("drops the previous run's expected receive amount", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(priorRun)

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ expectedReceiveSats: undefined }),
      )
    })

    /** The caller re-sends the figure it already holds on every save, to heal a write that
     *  never landed, so a restart has to refuse it from the update as well. */
    it("drops it even when the caller echoes it back in the update", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(priorRun)

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupMethod,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 36726,
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ expectedReceiveSats: undefined }),
      )
    })

    it("keeps the wallet it already provisioned", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(priorRun)

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.TermsAndConditions,
        custodialAccountId: "cust-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ accountId: "sc-1" }),
      )
    })

    it("takes the new run's own figure once it reaches the commit point again", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        ...priorRun,
        step: MigrationCheckpoint.TermsAndConditions,
        expectedReceiveSats: undefined,
      })

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 41000,
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ expectedReceiveSats: 41000 }),
      )
    })

    it("still holds the figure across a re-entered commit screen", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(priorRun)

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 0,
      })

      expect(mockSaveJson).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({ expectedReceiveSats: 36726 }),
      )
    })
  })

  describe("clearCheckpointFromStorage", () => {
    it("removes key from storage", async () => {
      await clearCheckpointFromStorage("test-key")
      expect(mockRemove).toHaveBeenCalledWith("test-key")
    })
  })

  describe("pending provisioned accounts", () => {
    it("namespaces the pending key by environment", () => {
      expect(getPendingAccountsStorageKey("Main")).toBe("migrationPendingAccounts_main")
    })

    it("returns an empty map for missing or malformed storage", async () => {
      mockLoadJsonOrThrow.mockResolvedValue(null)
      expect(await loadPendingProvisionedAccounts("pending-key")).toEqual({})

      mockLoadJsonOrThrow.mockResolvedValue(["not", "a", "map"])
      expect(await loadPendingProvisionedAccounts("pending-key")).toEqual({})

      mockLoadJsonOrThrow.mockResolvedValue({ "custodial-1": 42, "custodial-2": "sc-2" })
      expect(await loadPendingProvisionedAccounts("pending-key")).toEqual({
        "custodial-2": "sc-2",
      })
    })

    it("saves a pending wallet without touching other owners", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({ "custodial-2": "sc-2" })

      await savePendingProvisionedAccount("pending-key", {
        custodialAccountId: "custodial-1",
        accountId: "sc-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("pending-key", {
        "custodial-1": "sc-1",
        "custodial-2": "sc-2",
      })
    })

    it("clears only the given owner's pending wallet", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        "custodial-1": "sc-1",
        "custodial-2": "sc-2",
      })

      await clearPendingProvisionedAccount("pending-key", "custodial-1")

      expect(mockSaveJson).toHaveBeenCalledWith("pending-key", { "custodial-2": "sc-2" })
    })
  })
})
