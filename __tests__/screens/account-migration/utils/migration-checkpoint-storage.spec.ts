import {
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  isCommitPointCheckpoint,
  isExpired,
  loadCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
  getPendingAccountsStorageKey,
  savePendingProvisionedAccount,
  clearPendingProvisionedWallet,
  validateStoredCheckpoint,
  readPendingProvisionedAccounts,
} from "@app/screens/account-migration/utils/migration-checkpoint-storage"

const mockLoadJson = jest.fn()
const mockSaveJson = jest.fn()
const mockRemove = jest.fn()
const mockGetItem = jest.fn()

jest.mock("@app/utils/storage", () => ({
  loadJson: (...args: readonly unknown[]) => mockLoadJson(...args),
  saveJson: (...args: readonly unknown[]) => mockSaveJson(...args),
  remove: (...args: readonly unknown[]) => mockRemove(...args),
}))

/** The strict read reaches AsyncStorage directly, because that is the only level where a
 *  failed read is still distinguishable from a missing key. */
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: (...args: readonly unknown[]) => mockGetItem(...args) },
}))

/** Seeds the record the strict read returns: the writers read through it, so a write-back
 *  can never be built on a map that was never actually seen. */
const setStoredRecord = (record: Record<string, string>) => {
  mockGetItem.mockResolvedValue(JSON.stringify(record))
}

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

    it("re-throws the original error even when the cleanup removal fails", async () => {
      mockLoadJson.mockRejectedValue(new Error("corrupt"))
      mockRemove.mockRejectedValue(new Error("remove failed"))

      await expect(loadCheckpoint("test-key")).rejects.toThrow("corrupt")
    })

    it("returns null for null storage", async () => {
      mockLoadJson.mockResolvedValue(null)

      const result = await loadCheckpoint("test-key")
      expect(result).toBeNull()
    })
  })

  describe("saveCheckpointToStorage", () => {
    it("persists step and timestamp", async () => {
      mockLoadJson.mockResolvedValue(null)
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
      mockLoadJson.mockResolvedValue(null)
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue(null)
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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
      mockLoadJson.mockResolvedValue({
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

    it("saves the step even when reading the previous checkpoint fails", async () => {
      mockLoadJson.mockRejectedValue(new Error("read failed"))

      await saveCheckpointToStorage("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
      })

      expect(mockSaveJson).toHaveBeenCalledWith("test-key", {
        step: MigrationCheckpoint.BackupAlerts,
        savedAt: expect.any(Number),
      })
    })

    it("drops an expired prior record's account id instead of lending it to the fresh save", async () => {
      mockLoadJson.mockResolvedValue({
        step: MigrationCheckpoint.BackupMethod,
        savedAt: Date.now() - 49 * 60 * 60 * 1000,
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
        accountId: undefined,
        custodialAccountId: "cust-1",
      })
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

    it("saves a pending wallet without touching other owners", async () => {
      setStoredRecord({ "custodial-2": "sc-2" })

      await savePendingProvisionedAccount("pending-key", {
        custodialAccountId: "custodial-1",
        accountId: "sc-1",
      })

      expect(mockSaveJson).toHaveBeenCalledWith("pending-key", {
        "custodial-1": "sc-1",
        "custodial-2": "sc-2",
      })
    })
  })
})

/**
 * The only read of this record, and strict on purpose: a tolerant one turns every failure
 * into "nothing is pending", which is the single answer that grants permission to delete
 * the only key to funds in flight.
 */
describe("readPendingProvisionedAccounts (strict)", () => {
  it("reads the record when storage answers", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ "custodial-1": "sc-1" }))

    expect(await readPendingProvisionedAccounts("pending-key")).toEqual({
      status: "ok",
      pendingByOwner: { "custodial-1": "sc-1" },
    })
  })

  /** A key that was never written is an answer, not a failure: nothing is pending. */
  it("reads a missing key as an empty record, not a failure", async () => {
    mockGetItem.mockResolvedValue(null)

    expect(await readPendingProvisionedAccounts("pending-key")).toEqual({
      status: "ok",
      pendingByOwner: {},
    })
  })

  /** A key holding nothing is still a key with nothing in it, not a record that will not
   *  parse: calling it corrupt would block every deletion over an empty string. */
  it("reads an empty value as an empty record too", async () => {
    mockGetItem.mockResolvedValue("")

    expect(await readPendingProvisionedAccounts("pending-key")).toEqual({
      status: "ok",
      pendingByOwner: {},
    })
  })

  /** Parses fine, but is not a record. Flattening it to an empty map would answer "nothing
   *  is pending" on a storage fault, which is the one answer that grants deletion. */
  it("reports a parseable non-record as corrupt", async () => {
    for (const value of ["null", "42", "[]", '"text"']) {
      mockGetItem.mockResolvedValue(value)

      const read = await readPendingProvisionedAccounts("pending-key")

      expect(read.status).toBe("corrupt")
    }
  })

  it("reports a failed read rather than answering with an empty record", async () => {
    mockGetItem.mockRejectedValue(new Error("AsyncStorage unavailable"))

    const read = await readPendingProvisionedAccounts("pending-key")

    expect(read.status).toBe("read-failed")
    /** The cause travels, so the report that follows is not a bare synthetic error. */
    expect(read).toHaveProperty("error.message", "AsyncStorage unavailable")
  })

  /** Different in kind from a store that could not answer: nothing is recoverable from it,
   *  so a writer is allowed to repair it while a reader deciding to destroy is not allowed
   *  to act on it. */
  it("reports a value that will not parse as corrupt, not as a failed read", async () => {
    mockGetItem.mockResolvedValue("not-json")

    const read = await readPendingProvisionedAccounts("pending-key")

    expect(read.status).toBe("corrupt")
  })

  it("drops entries of the wrong shape but still reports a successful read", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ "custodial-1": 42, "custodial-2": "sc-2" }),
    )

    expect(await readPendingProvisionedAccounts("pending-key")).toEqual({
      status: "ok",
      pendingByOwner: { "custodial-2": "sc-2" },
    })
  })
})

/**
 * Each writer is a read, a change and a write back. Interleaved, the second reads the
 * snapshot the first took before its write landed, and whichever finishes last writes the
 * other's entry away: a mark that gates deletion would come back, or a saved one vanish.
 */
describe("pending record writes, serialized per key", () => {
  it("does not let a concurrent save and clear overwrite each other", async () => {
    const stored: Record<string, string> = { "custodial-1": "sc-1" }
    mockGetItem.mockImplementation(async () => JSON.stringify(stored))
    mockSaveJson.mockImplementation(
      async (_key: string, value: Record<string, string>) => {
        Object.keys(stored).forEach((key) => delete stored[key])
        Object.assign(stored, value)
      },
    )

    await Promise.all([
      savePendingProvisionedAccount("pending-key", {
        custodialAccountId: "custodial-2",
        accountId: "sc-2",
      }),
      clearPendingProvisionedWallet("pending-key", "sc-1"),
    ])

    expect(stored).toEqual({ "custodial-2": "sc-2" })
  })

  it("keeps running after a write that failed", async () => {
    setStoredRecord({})
    mockSaveJson.mockRejectedValueOnce(new Error("write failed"))
    mockSaveJson.mockResolvedValue(undefined)

    await expect(
      savePendingProvisionedAccount("pending-key", {
        custodialAccountId: "custodial-1",
        accountId: "sc-1",
      }),
    ).rejects.toThrow("write failed")

    await expect(
      clearPendingProvisionedWallet("pending-key", "sc-1"),
    ).resolves.toBeUndefined()
  })

  /** Records under different keys share nothing, so one must not wait on the other. */
  it("runs different keys independently", async () => {
    setStoredRecord({})
    mockSaveJson.mockResolvedValue(undefined)

    await Promise.all([
      clearPendingProvisionedWallet("pending-key-a", "sc-1"),
      clearPendingProvisionedWallet("pending-key-b", "sc-2"),
    ])

    expect(mockSaveJson).toHaveBeenCalledWith("pending-key-a", {})
    expect(mockSaveJson).toHaveBeenCalledWith("pending-key-b", {})
  })
})
