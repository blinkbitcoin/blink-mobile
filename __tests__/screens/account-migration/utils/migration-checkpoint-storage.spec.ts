import {
  CHECKPOINT_WRITE_TIMEOUT_MS,
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  isCommitPointCheckpoint,
  loadCheckpoint,
  mergeCheckpoint,
  resolveCommitPointRoute,
  RESTART_ROUTE,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
  getPendingAccountsStorageKey,
  loadPendingProvisionedAccounts,
  savePendingProvisionedAccount,
  clearPendingProvisionedAccount,
  validateStoredCheckpoint,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"
import { CommitPointRoute, ServerMigrationFlow } from "@app/types/migration"

const mockLoadJsonOrThrow = jest.fn()
const mockSaveJson = jest.fn()
const mockRemove = jest.fn()

jest.mock("@app/utils/storage", () => ({
  loadJsonOrThrow: (...args: readonly unknown[]) => mockLoadJsonOrThrow(...args),
  saveJson: (...args: readonly unknown[]) => mockSaveJson(...args),
  removeOrThrow: (...args: readonly unknown[]) => mockRemove(...args),
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

    /** A restart and a device with nothing to resume must land in the same place, and that
     *  place must never be the commit screen. */
    it("restarts where a checkpoint-less device starts", () => {
      expect(RESTART_ROUTE).toBe(resolveCheckpointRoute(null).name)
      expect(RESTART_ROUTE).not.toBe("accountMigrationBalancesOverview")
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

    /** Nothing expires on the device any more: a month-old record still routes by its
     *  stored step, and the server's lock is what decides whether that step still holds. */
    it("routes a month-old record by its stored step", async () => {
      mockLoadJsonOrThrow.mockResolvedValue({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        accountId: "sc-1",
      })

      const result = await loadCheckpoint("test-key")

      expect(resolveCheckpointRoute(result?.step ?? null)).toEqual({
        name: "accountMigrationBalancesOverview",
      })
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
    /** The only way back behind the commit point: the routing only restarts a flow the
     *  server confirmed cleared, and the backup screens only save while focused, so a step
     *  regression is a restart and its predecessor's figures are stale. */
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

describe("migration-checkpoint-storage a confirmed start", () => {
  it("keeps a confirmed start on a stored record", () => {
    expect(
      validateStoredCheckpoint({
        step: MigrationCheckpoint.BalancesOverview,
        savedAt: 1,
        isStartConfirmed: true,
      }),
    ).toMatchObject({ isStartConfirmed: true })
  })

  /** Advisory: anything but a literal true reads as unconfirmed, which resumes, and the
   *  step and ids the record carries survive. */
  it("reads anything but a literal true as unconfirmed, keeping the record", () => {
    const record = validateStoredCheckpoint({
      step: MigrationCheckpoint.BalancesOverview,
      savedAt: 1,
      accountId: "sc-1",
      isStartConfirmed: "yes",
    })

    expect(record).toMatchObject({ accountId: "sc-1" })
    expect(record?.isStartConfirmed).toBeUndefined()
  })

  const confirmedRun = {
    step: MigrationCheckpoint.BalancesOverview,
    savedAt: 1,
    accountId: "sc-1",
    custodialAccountId: "cust-1",
    expectedReceiveSats: 36726,
    isStartConfirmed: true as const,
  }

  it("sets it from the update that saw the start accepted", () => {
    const merged = mergeCheckpoint(null, {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      isStartConfirmed: true,
    })

    expect(merged.isStartConfirmed).toBe(true)
  })

  it("keeps it across later saves of the same run", () => {
    const merged = mergeCheckpoint(confirmedRun, {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
    })

    expect(merged.isStartConfirmed).toBe(true)
  })

  /** The new run has not started anything yet: carrying the old confirmation would make
   *  its own not-started read as cleared and restart it again. */
  it("drops it when the run starts over", () => {
    const merged = mergeCheckpoint(confirmedRun, {
      step: MigrationCheckpoint.TermsAndConditions,
      custodialAccountId: "cust-1",
    })

    expect(merged.isStartConfirmed).toBeUndefined()
  })

  it("never lends it to another account's flow", () => {
    const merged = mergeCheckpoint(confirmedRun, {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-2",
    })

    expect(merged.isStartConfirmed).toBeUndefined()
  })
})

/** Before the server has started a run nothing has been drained, so the figure the
 *  commit screen first saw is only a guess: a dollar balance converted from that same
 *  screen moves the bitcoin it will send, and a stale zero reads as "nothing will ever
 *  arrive", which swaps before the funds land (#4102). */
/** A save reads the record and writes back a merge of it. Left to overlap, a later save
 *  merges against the record from before an earlier one landed and writes over it; here a
 *  read that answers late stands in for whatever lets two saves overlap. */
describe("migration-checkpoint-storage writes to one key", () => {
  let disk: unknown = null
  const deferredReads: Array<() => void> = []

  beforeEach(() => {
    jest.clearAllMocks()
    disk = null
    deferredReads.length = 0
    mockSaveJson.mockImplementation(async (_key: string, value: unknown) => {
      disk = value
    })
    mockRemove.mockImplementation(async () => {
      disk = null
    })
  })

  /** The first read waits to be released; every later one answers at once. */
  const holdFirstRead = () => {
    mockLoadJsonOrThrow
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            deferredReads.push(() => resolve(disk))
          }),
      )
      .mockImplementation(async () => disk)
  }

  /** A queued save starts a turn later, so its read is released once it has been issued
   *  rather than the moment the save is called. */
  const releaseHeldRead = async () => {
    for (let turn = 0; turn < 50 && deferredReads.length === 0; turn += 1) {
      await Promise.resolve()
    }
    const release = deferredReads.shift()
    if (!release) throw new Error("the held read was never issued")
    release()
  }

  it("keeps the accepted start when an earlier save would otherwise land on top", async () => {
    holdFirstRead()

    const stepSave = saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 990,
    })
    const confirmedSave = saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 990,
      isStartConfirmed: true,
    })
    await releaseHeldRead()
    await Promise.all([stepSave, confirmedSave])

    expect(disk).toEqual(expect.objectContaining({ isStartConfirmed: true }))
  })

  it("does not bring back a checkpoint cleared while a save was in flight", async () => {
    holdFirstRead()

    const save = saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 990,
    })
    const clear = clearCheckpointFromStorage("test-key")
    await releaseHeldRead()
    await Promise.all([save, clear])

    expect(disk).toBeNull()
  })

  /** A refused save passes the turn on: the next one still runs, and the refusal still
   *  reaches its own caller. */
  it("runs the next save after one that failed", async () => {
    mockLoadJsonOrThrow
      .mockRejectedValueOnce(new Error("Database Error"))
      .mockImplementation(async () => disk)

    const refused = saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
    })
    const next = saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 990,
    })

    await expect(refused).rejects.toThrow("Database Error")
    await expect(next).resolves.toEqual(
      expect.objectContaining({ expectedReceiveSats: 990 }),
    )
  })

  it("answers with the record it wrote", async () => {
    mockLoadJsonOrThrow.mockResolvedValue({
      step: MigrationCheckpoint.BackupMethod,
      savedAt: 1,
      accountId: "sc-1",
      custodialAccountId: "cust-1",
    })

    const written = await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 990,
    })

    expect(written).toEqual(disk)
    expect(written).toEqual(expect.objectContaining({ accountId: "sc-1" }))
  })

  /** A native call that never settles would otherwise hold every caller forever: the commit
   *  screen's Approve waits on the write, and with no answer there is no retry to offer. */
  describe("a turn that never settles", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    /** Its own key, released before the test ends: the queue is module state, and a turn
     *  left hanging would hold every later test's writes to the same key. */
    const HUNG_KEY = "hung-key"

    it("answers its caller with a failure once the wait runs out", async () => {
      holdFirstRead()

      const save = saveCheckpointToStorage(HUNG_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 990,
      })
      const outcome = save.then(
        () => "saved",
        (err: Error) => err.message,
      )
      jest.advanceTimersByTime(CHECKPOINT_WRITE_TIMEOUT_MS)

      await expect(outcome).resolves.toContain("did not settle")
      await releaseHeldRead()
    })

    it("answers in time when the write lands in time", async () => {
      holdFirstRead()

      const save = saveCheckpointToStorage(HUNG_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 990,
      })
      jest.advanceTimersByTime(CHECKPOINT_WRITE_TIMEOUT_MS - 1)
      await releaseHeldRead()

      await expect(save).resolves.toEqual(
        expect.objectContaining({ expectedReceiveSats: 990 }),
      )
    })

    /** The caller is told, but the turn is not given up. The stalled call here is the
     *  write itself, holding a merge made before the next save: let the next one past it,
     *  and the stalled one lands on top and drops the accepted start. */
    it("keeps the next write behind the stalled one until it lands", async () => {
      mockLoadJsonOrThrow.mockImplementation(async () => disk)
      let landStalledWrite: () => void = () => {
        throw new Error("the stalled write was never issued")
      }
      mockSaveJson.mockImplementationOnce(
        (_key: string, value: unknown) =>
          new Promise<void>((resolve) => {
            landStalledWrite = () => {
              disk = value
              resolve()
            }
          }),
      )
      const flushTurns = async () => {
        for (let turn = 0; turn < 50; turn += 1) await Promise.resolve()
      }

      const stalled = saveCheckpointToStorage(HUNG_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 990,
      }).catch(() => undefined)
      const next = saveCheckpointToStorage(HUNG_KEY, {
        step: MigrationCheckpoint.BalancesOverview,
        custodialAccountId: "cust-1",
        expectedReceiveSats: 990,
        isStartConfirmed: true,
      }).catch(() => undefined)
      await flushTurns()
      jest.advanceTimersByTime(CHECKPOINT_WRITE_TIMEOUT_MS)
      await Promise.all([stalled, next])
      await flushTurns()

      expect(mockSaveJson).toHaveBeenCalledTimes(1)

      landStalledWrite()
      await flushTurns()

      expect(mockSaveJson).toHaveBeenCalledTimes(2)
      expect(disk).toEqual(expect.objectContaining({ isStartConfirmed: true }))
    })
  })
})

describe("migration-checkpoint-storage a commit point the server has not started", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const unstartedCommitPoint = {
    step: MigrationCheckpoint.BalancesOverview,
    savedAt: Date.now(),
    accountId: "sc-1",
    custodialAccountId: "cust-1",
    expectedReceiveSats: 0,
  }

  it("takes the fresh figure over the one it first saw", async () => {
    mockLoadJsonOrThrow.mockResolvedValue(unstartedCommitPoint)

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 5000,
      isServerFlowUnstarted: true,
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ expectedReceiveSats: 5000 }),
    )
  })

  /** The save that carries the accepted start is the last one before the drain, so its
   *  figure is the run's own and is kept from then on. */
  it("takes it on the save that confirms the start too", async () => {
    mockLoadJsonOrThrow.mockResolvedValue(unstartedCommitPoint)

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 5000,
      isStartConfirmed: true,
      isServerFlowUnstarted: true,
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ expectedReceiveSats: 5000, isStartConfirmed: true }),
    )
  })

  /** The merge the commit screen's held start exists for: a save that confirms the start
   *  without the server's answer binds the figure already stored, so a start allowed to
   *  land before the phase read would keep the pre-conversion zero for the whole run. */
  it("binds the stored figure on a save that confirms the start without the answer", async () => {
    mockLoadJsonOrThrow.mockResolvedValue(unstartedCommitPoint)

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 5000,
      isStartConfirmed: true,
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ expectedReceiveSats: 0, isStartConfirmed: true }),
    )
  })

  /** A start this device saw accepted owns its figure, whatever a stale read of the
   *  phase still says: the drain may already have emptied what the preview reads. */
  it("keeps the figure of a run whose start was confirmed", async () => {
    mockLoadJsonOrThrow.mockResolvedValue({
      ...unstartedCommitPoint,
      expectedReceiveSats: 990,
      isStartConfirmed: true,
    })

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 0,
      isServerFlowUnstarted: true,
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ expectedReceiveSats: 990 }),
    )
  })

  /** A record from before the confirmed start existed, on a flow the server holds open:
   *  the run may have drained already, so the live zero is the one to distrust. */
  it("keeps the figure of an unconfirmed record whose flow is open", async () => {
    mockLoadJsonOrThrow.mockResolvedValue({
      ...unstartedCommitPoint,
      expectedReceiveSats: 990,
    })

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 0,
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ expectedReceiveSats: 990 }),
    )
  })

  it("does not write the server's answer into the record", async () => {
    mockLoadJsonOrThrow.mockResolvedValue(unstartedCommitPoint)

    await saveCheckpointToStorage("test-key", {
      step: MigrationCheckpoint.BalancesOverview,
      custodialAccountId: "cust-1",
      expectedReceiveSats: 5000,
      isServerFlowUnstarted: true,
    })

    const [, saved] = mockSaveJson.mock.calls[0]
    expect(saved).not.toHaveProperty("isServerFlowUnstarted")
  })
})

/** The one rule the entry screen and the step routing both follow for a commit point. */
describe("migration-checkpoint-storage resolveCommitPointRoute", () => {
  it("resumes an open flow, confirmed start or not", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.Open, true)).toBe(
      CommitPointRoute.Resume,
    )
    expect(resolveCommitPointRoute(ServerMigrationFlow.Open, false)).toBe(
      CommitPointRoute.Resume,
    )
  })

  it("restarts a flow support cleared after its start was accepted", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.NotStarted, true)).toBe(
      CommitPointRoute.Restart,
    )
  })

  /** A dollar balance, a failed start, or a cut-off one: the server reads not started
   *  because it has not started yet, and the commit screen is where it does. */
  it("resumes a flow whose start the server never accepted", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.NotStarted, false)).toBe(
      CommitPointRoute.Resume,
    )
  })

  it("waits for the swap once the server completed the migration", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.Completed, true)).toBe(
      CommitPointRoute.AwaitSwap,
    )
    expect(resolveCommitPointRoute(ServerMigrationFlow.Completed, false)).toBe(
      CommitPointRoute.AwaitSwap,
    )
  })

  it("asks again when the server gave no answer", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.Unanswered, true)).toBe(
      CommitPointRoute.AskAgain,
    )
    expect(resolveCommitPointRoute(ServerMigrationFlow.Unanswered, false)).toBe(
      CommitPointRoute.AskAgain,
    )
  })

  /** Asking again would only get the same unknown phase back. */
  it("hands over when the server answered with a phase this build does not know", () => {
    expect(resolveCommitPointRoute(ServerMigrationFlow.Unrecognised, true)).toBe(
      CommitPointRoute.HandOver,
    )
    expect(resolveCommitPointRoute(ServerMigrationFlow.Unrecognised, false)).toBe(
      CommitPointRoute.HandOver,
    )
  })
})
