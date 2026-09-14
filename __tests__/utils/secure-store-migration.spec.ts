/* eslint-disable camelcase */
import { ACCESSIBLE } from "react-native-keychain"

import { legacyErase, legacyRead } from "@app/utils/storage/legacy-key-store"
import {
  existsThrough,
  readThrough,
  removeThrough,
  writeThrough,
} from "@app/utils/storage/secure-store-migration"
import {
  secureExists,
  secureRead,
  secureRemove,
  secureWrite,
} from "@app/utils/storage/secure-store"

const mockLogEvent = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

const mockRecordAppError = jest.fn()

jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

jest.mock("@app/utils/storage/secure-store", () => ({
  ...jest.requireActual("@app/utils/storage/secure-store"),
  secureRead: jest.fn(),
  secureWrite: jest.fn(),
  secureRemove: jest.fn(),
  secureExists: jest.fn(),
}))

jest.mock("@app/utils/storage/legacy-key-store", () => ({
  ...jest.requireActual("@app/utils/storage/legacy-key-store"),
  legacyRead: jest.fn(),
  legacyErase: jest.fn(),
}))

const mockedSecureRead = jest.mocked(secureRead)
const mockedSecureWrite = jest.mocked(secureWrite)
const mockedSecureRemove = jest.mocked(secureRemove)
const mockedSecureExists = jest.mocked(secureExists)
const mockedLegacyRead = jest.mocked(legacyRead)
const mockedLegacyErase = jest.mocked(legacyErase)

const ARGS = {
  slot: "sessionProfiles",
  legacyKey: "sessionProfiles",
  accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  deleteLegacyOnMigrate: true,
}

const REMOVE_ARGS = { slot: ARGS.slot, legacyKey: ARGS.legacyKey }

// A test that fails before restoring them would otherwise leak fake timers into
// every test after it.
afterEach(() => {
  jest.useRealTimers()
})

describe("readThrough", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // The real logEvent returns a promise; a bare jest.fn() would not, and the
    // counter's rejection handling would never be exercised.
    mockLogEvent.mockResolvedValue(undefined)
    mockedSecureWrite.mockResolvedValue(true)
    mockedLegacyErase.mockResolvedValue(true)
  })

  describe("the new store answers", () => {
    it("returns its value and never touches the legacy library", async () => {
      mockedSecureRead.mockResolvedValue({ status: "found", value: "new-value" })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "new-value" })
      expect(mockedLegacyRead).not.toHaveBeenCalled()
      expect(mockedSecureWrite).not.toHaveBeenCalled()
      expect(mockedSecureRead).toHaveBeenCalledWith(ARGS.slot)
    })

    it("wins over a legacy copy holding a different value, without comparing", async () => {
      mockedSecureRead.mockResolvedValue({ status: "found", value: "new-value" })
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "stale-value" })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "new-value" })
      expect(mockedLegacyRead).not.toHaveBeenCalled()
    })

    it("reports its failure as failed and does not fall back to legacy", async () => {
      const err = new Error("E_CRYPTO_FAILED")
      mockedSecureRead.mockResolvedValue({ status: "failed", err })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "failed", err })
      expect(mockedLegacyRead).not.toHaveBeenCalled()
      expect(mockedSecureWrite).not.toHaveBeenCalled()
    })
  })

  describe("the legacy store answers", () => {
    beforeEach(() => {
      mockedSecureRead.mockResolvedValue({ status: "absent" })
    })

    it("returns the legacy value and migrates it to the new store", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockedLegacyRead).toHaveBeenCalledWith(ARGS.legacyKey)
      expect(mockedSecureWrite).toHaveBeenCalledWith(
        ARGS.slot,
        "legacy-value",
        ARGS.accessible,
      )
    })

    it("writes the new copy before erasing the legacy one", async () => {
      const calls: string[] = []
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      mockedSecureWrite.mockImplementation(async () => {
        calls.push("write")
        return true
      })
      mockedLegacyErase.mockImplementation(async () => {
        calls.push("erase")
        return true
      })

      await readThrough(ARGS)

      expect(calls).toEqual(["write", "erase"])
      expect(mockedLegacyErase).toHaveBeenCalledWith(ARGS.legacyKey)
    })

    it("keeps the legacy copy when the migrating write fails", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      mockedSecureWrite.mockResolvedValue(false)

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockedLegacyErase).not.toHaveBeenCalled()
    })

    it("keeps the legacy copy when the caller opts out of deleting it", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      const read = await readThrough({ ...ARGS, deleteLegacyOnMigrate: false })

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockedSecureWrite).toHaveBeenCalled()
      expect(mockedLegacyErase).not.toHaveBeenCalled()
    })

    it("still returns the value when erasing the legacy copy fails", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      mockedLegacyErase.mockResolvedValue(false)

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Legacy key store erase failed: sessionProfiles",
        }),
        { dedupKey: "storage-legacy-erase-failed-sessionProfiles" },
      )
    })

    it("reports nothing when the erase failed on a key that was already gone", async () => {
      mockedLegacyRead
        .mockResolvedValueOnce({ status: "found", value: "legacy-value" })
        .mockResolvedValueOnce({ status: "absent" })
      mockedLegacyErase.mockResolvedValue(false)

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockRecordAppError).not.toHaveBeenCalled()
    })

    it("reports nothing when the legacy copy is erased cleanly", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      await readThrough(ARGS)

      expect(mockRecordAppError).not.toHaveBeenCalled()
    })

    it("serves two concurrent reads the same value, migrating once", async () => {
      let stored: string | null = null
      mockedSecureRead.mockImplementation(async () => {
        if (stored === null) return { status: "absent" }
        return { status: "found", value: stored }
      })
      mockedSecureWrite.mockImplementation(async (_slot, value) => {
        stored = value
        return true
      })
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      const [first, second] = await Promise.all([readThrough(ARGS), readThrough(ARGS)])

      expect(first).toEqual({ status: "found", value: "legacy-value" })
      expect(second).toEqual(first)
      expect(mockedSecureWrite).toHaveBeenCalledTimes(1)
      expect(mockedSecureWrite).toHaveBeenCalledWith(
        ARGS.slot,
        "legacy-value",
        ARGS.accessible,
      )
    })
  })

  describe("neither store answers", () => {
    beforeEach(() => {
      mockedSecureRead.mockResolvedValue({ status: "absent" })
    })

    it("reports absent, the only path that produces it", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "absent" })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "absent" })
      expect(mockedSecureWrite).not.toHaveBeenCalled()
      expect(mockedLegacyErase).not.toHaveBeenCalled()
    })

    it("reports a failed legacy read as failed, never as absent", async () => {
      const err = new Error("keystore unavailable")
      mockedLegacyRead.mockResolvedValue({ status: "failed", err })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "failed", err })
      expect(mockedSecureWrite).not.toHaveBeenCalled()
      expect(mockedLegacyErase).not.toHaveBeenCalled()
    })
  })

  describe("the legacy-hit counter", () => {
    beforeEach(() => {
      mockedSecureRead.mockResolvedValue({ status: "absent" })
    })

    it("counts a legacy hit, tagged by key class", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      await readThrough(ARGS)

      expect(mockLogEvent).toHaveBeenCalledWith("legacy_key_store_hit", {
        key_class: "sessionProfiles",
      })
    })

    it("drops the account id from a per-account key", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

      await readThrough({ ...ARGS, legacyKey: "mnemonic:account-abc123" })

      expect(mockLogEvent).toHaveBeenCalledWith("legacy_key_store_hit", {
        key_class: "mnemonic",
      })
    })

    it("does not count a read the new store answered", async () => {
      mockedSecureRead.mockResolvedValue({ status: "found", value: "new-value" })

      await readThrough(ARGS)

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("does not count a miss in both stores", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "absent" })

      await readThrough(ARGS)

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("still returns the value when the counter itself throws", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      mockLogEvent.mockImplementation(() => {
        throw new Error("analytics not initialised")
      })

      const read = await readThrough(ARGS)

      expect(read).toEqual({ status: "found", value: "legacy-value" })
      expect(mockedSecureWrite).toHaveBeenCalled()
    })

    it("handles the rejection of the promise the counter returns", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      const catchHandler = jest.fn().mockReturnValue(Promise.resolve())
      mockLogEvent.mockReturnValue({ catch: catchHandler })

      const read = await readThrough(ARGS)

      expect(catchHandler).toHaveBeenCalled()
      expect(read).toEqual({ status: "found", value: "legacy-value" })
    })

    it("swallows a rejected counter without failing the read", async () => {
      mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })
      mockLogEvent.mockRejectedValue(new Error("analytics transport down"))

      expect(await readThrough(ARGS)).toEqual({ status: "found", value: "legacy-value" })
    })
  })
})

describe("removeThrough", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogEvent.mockResolvedValue(undefined)
    mockedSecureRemove.mockResolvedValue(true)
    mockedLegacyErase.mockResolvedValue(true)
  })

  it("erases the legacy copy before removing the new slot", async () => {
    const calls: string[] = []
    mockedLegacyErase.mockImplementation(async () => {
      calls.push("legacy")
      return true
    })
    mockedSecureRemove.mockImplementation(async () => {
      calls.push("new")
      return true
    })

    expect(await removeThrough(REMOVE_ARGS)).toBe(true)
    expect(calls).toEqual(["legacy", "new"])
    expect(mockedLegacyErase).toHaveBeenCalledWith(REMOVE_ARGS.legacyKey)
    expect(mockedSecureRemove).toHaveBeenCalledWith(REMOVE_ARGS.slot)
  })

  it("reports false when the new-store removal fails", async () => {
    mockedSecureRemove.mockResolvedValue(false)

    expect(await removeThrough(REMOVE_ARGS)).toBe(false)
  })

  it("leaves the new slot alone when the legacy copy is still readable", async () => {
    mockedLegacyErase.mockResolvedValue(false)
    mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

    expect(await removeThrough(REMOVE_ARGS)).toBe(false)
    // Emptying the new store here is what would make the stale copy the answer
    // to the next read.
    expect(mockedSecureRemove).not.toHaveBeenCalled()
    expect(mockRecordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Legacy key store erase failed: sessionProfiles",
      }),
      { dedupKey: "storage-legacy-erase-failed-sessionProfiles" },
    )
  })

  it("leaves the new slot alone when the legacy store cannot say what is left", async () => {
    mockedLegacyErase.mockResolvedValue(false)
    mockedLegacyRead.mockResolvedValue({
      status: "failed",
      err: new Error("keystore unavailable"),
    })

    // Emptying the new store here would turn "two copies, one deleted" into
    // "one copy, and it is the stale one" the moment the legacy store recovers.
    expect(await removeThrough(REMOVE_ARGS)).toBe(false)
    expect(mockedSecureRemove).not.toHaveBeenCalled()
  })

  it("reports false when the operation times out", async () => {
    jest.useFakeTimers()
    mockedLegacyErase.mockImplementation(() => new Promise<never>(() => {}))

    const remove = removeThrough(REMOVE_ARGS)
    await jest.advanceTimersByTimeAsync(30_000)

    expect(await remove).toBe(false)
  })

  it("succeeds when the erase failed on a key that was never there", async () => {
    mockedLegacyErase.mockResolvedValue(false)
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    expect(await removeThrough(REMOVE_ARGS)).toBe(true)
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })
})

describe("per-slot serialization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogEvent.mockResolvedValue(undefined)
    mockedSecureWrite.mockResolvedValue(true)
    mockedSecureRemove.mockResolvedValue(true)
    mockedLegacyErase.mockResolvedValue(true)
  })

  it("holds a remove behind a read already in flight on the same slot", async () => {
    const calls: string[] = []
    mockedSecureRead.mockImplementation(async () => {
      calls.push("read:new")
      return { status: "absent" }
    })
    mockedLegacyRead.mockImplementation(async () => {
      calls.push("read:legacy")
      return { status: "found", value: "legacy-value" }
    })
    mockedSecureWrite.mockImplementation(async () => {
      calls.push("read:write")
      return true
    })
    mockedLegacyErase.mockImplementation(async () => {
      calls.push("legacy:erase")
      return true
    })
    mockedSecureRemove.mockImplementation(async () => {
      calls.push("remove:new")
      return true
    })

    const read = readThrough(ARGS)
    const remove = removeThrough(REMOVE_ARGS)

    expect(await read).toEqual({ status: "found", value: "legacy-value" })
    expect(await remove).toBe(true)
    // The read runs to completion first: its migrating write, then its erase of
    // the migrated copy, and only then the remove. Interleaved, the read writes
    // the legacy value back after the remove has already cleared the slot, and
    // the deleted credential is readable again.
    expect(calls).toEqual([
      "read:new",
      "read:legacy",
      "read:write",
      "legacy:erase",
      "legacy:erase",
      "remove:new",
    ])
  })

  it("does not make one slot wait on another", async () => {
    let releaseStuckSlot = () => {}
    mockedSecureRead.mockImplementation(async (slot) => {
      if (slot !== "stuck-slot") return { status: "absent" }
      return new Promise((resolve) => {
        releaseStuckSlot = () => resolve({ status: "absent" })
      })
    })
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    const stuck = readThrough({ ...ARGS, slot: "stuck-slot", legacyKey: "stuck-slot" })

    expect(await readThrough(ARGS)).toEqual({ status: "absent" })

    releaseStuckSlot()
    expect(await stuck).toEqual({ status: "absent" })
  })

  it("runs work queued behind a failed predecessor", async () => {
    mockedSecureRead
      .mockRejectedValueOnce(new Error("adapter blew up"))
      .mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    const first = readThrough(ARGS)
    const second = readThrough(ARGS)

    // The public helpers never reject: a thrown adapter is reported as failed.
    expect(await first).toEqual({
      status: "failed",
      err: expect.objectContaining({ message: "adapter blew up" }),
    })
    expect(await second).toEqual({ status: "absent" })
  })

  it("frees a slot whose operation never settles, instead of deadlocking it", async () => {
    jest.useFakeTimers()
    mockedSecureRead.mockImplementationOnce(() => new Promise<never>(() => {}))
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    const stuck = readThrough(ARGS)
    const queued = readThrough(ARGS)

    await jest.advanceTimersByTimeAsync(30_000)

    expect(await stuck).toEqual({
      status: "failed",
      err: expect.objectContaining({
        message: "secure store sessionProfiles timed out after 30000ms",
      }),
    })
    expect(await queued).toEqual({ status: "absent" })
  })

  it("drops the migrating write of an abandoned read that lands after a remove", async () => {
    jest.useFakeTimers()
    let releaseAbandonedRead: () => void = () => {}
    mockedSecureRead.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAbandonedRead = () => resolve({ status: "absent" })
        }),
    )
    mockedLegacyRead.mockResolvedValue({ status: "found", value: "stale-token" })
    mockedLegacyErase.mockResolvedValue(true)
    mockedSecureRemove.mockResolvedValue(true)

    const abandoned = readThrough(ARGS)
    await jest.advanceTimersByTimeAsync(30_000)
    expect(await abandoned).toEqual({
      status: "failed",
      err: expect.objectContaining({
        message: "secure store sessionProfiles timed out after 30000ms",
      }),
    })

    expect(await removeThrough(REMOVE_ARGS)).toBe(true)
    mockedSecureWrite.mockClear()

    // The hung native call finally answers. Its continuation is the danger: it
    // still holds the legacy value it was migrating, and the slot it was
    // migrating into has since been emptied by the remove above.
    releaseAbandonedRead()
    await jest.advanceTimersByTimeAsync(0)

    expect(mockedSecureWrite).not.toHaveBeenCalled()
  })

  it("drops the new-store delete of an abandoned remove that lands late", async () => {
    jest.useFakeTimers()
    let releaseAbandonedErase: () => void = () => {}
    mockedLegacyErase.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAbandonedErase = () => resolve(true)
        }),
    )
    mockedSecureRemove.mockResolvedValue(true)

    const abandoned = removeThrough(REMOVE_ARGS)
    await jest.advanceTimersByTimeAsync(30_000)
    expect(await abandoned).toBe(false)

    // The slot is free now, so whatever a caller writes next is what lives
    // there. The abandoned remove must not reach in and empty it.
    releaseAbandonedErase()
    await jest.advanceTimersByTimeAsync(0)

    expect(mockedSecureRemove).not.toHaveBeenCalled()
  })

  /** The read-through has already fetched the legacy value when a fresh one is
   *  saved. Unqueued, its migrating write lands last and the rotated credential
   *  is replaced by the one it rotated away from. */
  it("does not let a read-through migration overwrite a write issued after it", async () => {
    const calls: string[] = []
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    // Settles a few microtasks late, which is what lets an unqueued write slip
    // in front of the migrating one. Resolving rather than hanging keeps the
    // implementation from leaking a pending promise into the specs after it.
    mockedLegacyRead.mockImplementation(async () => {
      await Promise.resolve()
      await Promise.resolve()
      return { status: "found", value: "stale-token" }
    })
    mockedSecureWrite.mockImplementation(async (_slot, value) => {
      calls.push(`write:${value}`)
      return true
    })

    const read = readThrough(ARGS)
    const write = writeThrough({
      slot: ARGS.slot,
      value: "rotated-token",
      accessible: ARGS.accessible,
    })

    await read
    expect(await write).toBe(true)

    // Invocation order survives: the read was queued first, so its migrating
    // write runs first, and the token saved afterwards is the one left behind.
    expect(calls).toEqual(["write:stale-token", "write:rotated-token"])
  })

  /** The inverse race: a write still in flight when a logout removes the slot
   *  must not complete afterwards and restore the session. */
  it("does not let a write in flight complete after a remove queued behind it", async () => {
    const calls: string[] = []
    mockedSecureWrite.mockImplementation(async (_slot, value) => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      calls.push(`write:${value}`)
      return true
    })
    mockedLegacyErase.mockImplementation(async () => {
      calls.push("legacy:erase")
      return true
    })
    mockedSecureRemove.mockImplementation(async () => {
      calls.push("remove:new")
      return true
    })

    const write = writeThrough({
      slot: ARGS.slot,
      value: "session-token",
      accessible: ARGS.accessible,
    })
    const remove = removeThrough(REMOVE_ARGS)

    expect(await write).toBe(true)
    expect(await remove).toBe(true)

    // The remove runs strictly after the slow write, so the slot ends empty
    // rather than holding a credential the logout already cleared.
    expect(calls).toEqual(["write:session-token", "legacy:erase", "remove:new"])
  })

  /** Same contract as the other public helpers: nothing here rejects, so a
   *  thrown adapter reaches the caller as a plain false. */
  it("reports a thrown write as false rather than rejecting", async () => {
    mockedSecureWrite.mockRejectedValue(new Error("adapter blew up"))

    const write = await writeThrough({
      slot: ARGS.slot,
      value: "session-token",
      accessible: ARGS.accessible,
    })

    expect(write).toBe(false)
  })

  it("keeps an account id out of the timeout message", async () => {
    jest.useFakeTimers()
    mockedSecureRead.mockImplementation(() => new Promise<never>(() => {}))

    const stuck = readThrough({
      ...ARGS,
      slot: "mnemonic:account-abc123",
      legacyKey: "mnemonic:account-abc123",
    })

    await jest.advanceTimersByTimeAsync(30_000)

    expect(await stuck).toEqual({
      status: "failed",
      err: expect.objectContaining({
        message: "secure store mnemonic timed out after 30000ms",
      }),
    })
  })
})

describe("existsThrough", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogEvent.mockResolvedValue(undefined)
    mockedSecureWrite.mockResolvedValue(true)
    mockedLegacyErase.mockResolvedValue(true)
  })

  it("answers from the probe without decrypting or touching legacy", async () => {
    mockedSecureExists.mockResolvedValue({ status: "yes" })

    expect(await existsThrough(ARGS)).toEqual({ status: "yes" })
    expect(mockedSecureRead).not.toHaveBeenCalled()
    expect(mockedLegacyRead).not.toHaveBeenCalled()
  })

  it("reports a failed probe as failed, never as no", async () => {
    const err = new Error("E_CRYPTO_FAILED")
    mockedSecureExists.mockResolvedValue({ status: "failed", err })

    expect(await existsThrough(ARGS)).toEqual({ status: "failed", err })
    expect(mockedLegacyRead).not.toHaveBeenCalled()
  })

  it("answers yes for a slot that has yet to migrate, and migrates it", async () => {
    mockedSecureExists.mockResolvedValue({ status: "no" })
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "found", value: "legacy-value" })

    expect(await existsThrough(ARGS)).toEqual({ status: "yes" })
    expect(mockedSecureWrite).toHaveBeenCalledWith(
      ARGS.slot,
      "legacy-value",
      ARGS.accessible,
    )
  })

  it("answers no only when neither store has the slot", async () => {
    mockedSecureExists.mockResolvedValue({ status: "no" })
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    expect(await existsThrough(ARGS)).toEqual({ status: "no" })
  })

  it("waits for a remove in flight on the same slot before answering", async () => {
    const calls: string[] = []
    mockedLegacyErase.mockImplementation(async () => {
      calls.push("remove:legacy")
      return true
    })
    mockedSecureRemove.mockImplementation(async () => {
      calls.push("remove:new")
      return true
    })
    mockedSecureExists.mockImplementation(async () => {
      calls.push("exists:probe")
      return { status: "no" }
    })
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "absent" })

    const remove = removeThrough(REMOVE_ARGS)
    const exists = existsThrough(ARGS)

    expect(await remove).toBe(true)
    expect(await exists).toEqual({ status: "no" })
    // Probing outside the queue would let this answer yes for a slot the remove
    // is in the middle of deleting.
    expect(calls).toEqual(["remove:legacy", "remove:new", "exists:probe"])
  })

  it("reports failed when the operation times out", async () => {
    jest.useFakeTimers()
    mockedSecureExists.mockImplementation(() => new Promise<never>(() => {}))

    const exists = existsThrough(ARGS)
    await jest.advanceTimersByTimeAsync(30_000)

    expect(await exists).toEqual({
      status: "failed",
      err: expect.objectContaining({
        message: "secure store sessionProfiles timed out after 30000ms",
      }),
    })
  })

  it("reports a failed fallback read as failed, never as no", async () => {
    const err = new Error("keystore unavailable")
    mockedSecureExists.mockResolvedValue({ status: "no" })
    mockedSecureRead.mockResolvedValue({ status: "absent" })
    mockedLegacyRead.mockResolvedValue({ status: "failed", err })

    expect(await existsThrough(ARGS)).toEqual({ status: "failed", err })
  })
})
