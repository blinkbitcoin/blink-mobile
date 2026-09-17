/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import RNFS from "react-native-fs"
import Crypto from "react-native-quick-crypto"

import {
  RailType,
  TelemetryDirection,
  TelemetryEvent,
  WalletProvider,
  type ContractPayload,
} from "@app/telemetry/contract"
import {
  getDiagnosticCounters,
  resetDiagnosticsForTesting,
} from "@app/telemetry/diagnostics"
import {
  resetEnablementForTesting,
  setTelemetryRolloutEnabled,
} from "@app/telemetry/enablement"
import {
  drainActiveOutbox,
  getTelemetryHealth,
  resetTelemetryHealthReportingForTesting,
  setActiveOutbox,
} from "@app/telemetry/index"
import {
  isDrainPermitted,
  onTelemetrySuppressed,
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"
import {
  DRAIN_BACKOFF_INITIAL_MS,
  OUTBOX_MAX_RECORDS,
  OUTBOX_TTL_MS,
} from "@app/telemetry/outbox/config"
import { drainOutbox, resetDrainStateForTesting } from "@app/telemetry/outbox/drain"
import {
  OutboxState,
  parseOutboxRecord,
  type OutboxRecord,
} from "@app/telemetry/outbox/record"
import {
  createOutboxStore,
  getOutboxCounters,
  resetOutboxCountersForTesting,
  type LossCounters,
} from "@app/telemetry/outbox/store"
import {
  createLocalOnlyTransport,
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
  type SubmitResult,
} from "@app/telemetry/transport"

// The shared crashlytics mock hands back a fresh object per call, so there is no stable
// spy to read. Same local-mock pattern as use-delete-account.spec.ts.
const mockCrashlyticsLog = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  log: (...args: unknown[]) => mockCrashlyticsLog(...args),
  recordError: jest.fn(),
}))

const mockFs = RNFS as unknown as {
  __resetMockFileSystem: () => void
  __mockFilePaths: () => string[]
}

const randomUUID = Crypto.randomUUID as jest.Mock
let uuidSeed = 0

const DIR = "/mock/documents/blink-telemetry-outbox-regtest/account-1"

let minted = 0
const uuid = (n: number) =>
  `3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7${String(n).padStart(2, "0")}`

const record = (overrides: Partial<OutboxRecord> = {}): OutboxRecord => {
  minted += 1
  return {
    telemetryEventId: uuid(minted),
    event: TelemetryEvent.PaymentSettled,
    version: 1,
    payload: {
      event_version: 1,
      wallet_provider: WalletProvider.Spark,
      direction: TelemetryDirection.Send,
      rail_type: RailType.Lightning,
      telemetry_event_id: uuid(minted),
    },
    sdkPaymentId: `sdk-${minted}`,
    queuedAt: Date.now(),
    state: OutboxState.Queued,
    ...overrides,
  }
}

const transportReturning = (result: SubmitResult | (() => SubmitResult)) => {
  const submit = jest.fn<Promise<SubmitResult>, [ContractPayload]>(() =>
    Promise.resolve(typeof result === "function" ? result() : result),
  )
  registerTelemetryTransport({
    name: "test",
    ackSemantics: "application",
    attachesNoImplicitIdentity: true,
    submit,
  })
  return submit
}

const acked = (): SubmitResult => ({ kind: "acknowledged", ackedAt: Date.now() })
/** One macrotask, so a held submit has been reached before the test moves the mode. */
const settled = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })
const instantly = { delay: () => Promise.resolve() }

const resetEverything = () => {
  minted = 0
  // clearAllMocks only clears call records; the shared mock returns one constant id,
  // which would fold every unkeyed record onto a single file and hide a double report.
  randomUUID.mockReset()
  randomUUID.mockImplementation(() => uuid(90 + (uuidSeed += 1)))
  mockFs.__resetMockFileSystem()
  resetOutboxCountersForTesting()
  resetTelemetryModeForTesting()
  resetTelemetryTransportForTesting()
  resetDiagnosticsForTesting()
  resetTelemetryHealthReportingForTesting()
  resetDrainStateForTesting()
  resetEnablementForTesting()
  setTelemetryRolloutEnabled(true)
  mockCrashlyticsLog.mockClear()
  setActiveOutbox(null)
}

describe("the telemetry outbox", () => {
  beforeEach(resetEverything)

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("AD-6 / AD-26 — its own directory, temp-and-rename, discard is an unlink", () => {
    it("writes nowhere near the wallet store", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      const paths = mockFs.__mockFilePaths()
      expect(paths.every((path) => path.includes("blink-telemetry-outbox-regtest"))).toBe(
        true,
      )
      expect(paths.some((path) => path.includes("breez-sdk-spark"))).toBe(false)
    })

    it("writes every record to a temp name and renames it into place", async () => {
      // An in-memory mock cannot show a torn write; what it can show is the mechanism that
      // prevents one: the record reaches its final name only through a rename.
      const moveFile = jest.spyOn(RNFS, "moveFile")
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      expect(moveFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.json\.tmp$/),
        expect.stringMatching(/\.json$/),
      )
      expect(mockFs.__mockFilePaths().some((path) => path.endsWith(".tmp"))).toBe(false)
      moveFile.mockRestore()
    })

    it("never reads a temp file back as a record", async () => {
      // A crash between write and rename leaves the temp name; the reader must not see it.
      await RNFS.writeFile(`${DIR}/p-crashed.json.tmp`, JSON.stringify(record()), "utf8")

      expect(await createOutboxStore(DIR).pending()).toEqual([])
    })

    it("empties on discard, and is idempotent (FR-5)", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      await store.discardAll()
      expect(await store.pending()).toEqual([])

      await expect(store.discardAll()).resolves.toBeUndefined()
      expect(await store.pending()).toEqual([])
    })

    it("discards without a directory ever having existed", async () => {
      await expect(createOutboxStore(DIR).discardAll()).resolves.toBeUndefined()
    })

    it("leaves no marker after a discard that finished", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      await store.discardAll()

      expect(await store.hasPendingDiscard()).toBe(false)
    })

    /** Only the directory unlink fails; everything else — the marker's own unlink
     *  included — runs against the real mock. The earlier version of this test failed
     *  both, which hid the split outcome the second review's MEDIUM 1 describes. */
    const failDirectoryUnlink = () => {
      const realUnlink = RNFS.unlink
      return jest
        .spyOn(RNFS, "unlink")
        .mockImplementation((path) =>
          String(path) === DIR ? Promise.reject(new Error("EBUSY")) : realUnlink(path),
        )
    }

    it("keeps its marker when the directory survives the unlink, so the next run knows (AD-26)", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const unlink = failDirectoryUnlink()

      await expect(store.discardAll()).rejects.toThrow("did not finish")
      unlink.mockRestore()

      expect(await store.hasPendingDiscard()).toBe(true)
      expect(getOutboxCounters().discarded).toBe(0)
    })

    it("never hands out records behind a marker — a discard that did not finish is finished first, or the read fails", async () => {
      // The Anon transition required these destroyed. Returning them from `pending()` to
      // a later Enhanced drain would be FR-5 by the back door.
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const unlink = failDirectoryUnlink()
      await store.discardAll().catch(() => undefined)

      await expect(store.pending()).rejects.toThrow("did not finish")
      await expect(store.depth()).rejects.toThrow("did not finish")
      unlink.mockRestore()

      // The unlink works again: the next read finishes the discard, and the queue is empty.
      expect(await store.pending()).toEqual([])
      expect(await store.hasPendingDiscard()).toBe(false)
      expect(mockFs.__mockFilePaths().filter((path) => path.startsWith(DIR))).toEqual([])
    })

    it("still unlinks when the marker itself cannot be written", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const realWrite = RNFS.writeFile
      const write = jest
        .spyOn(RNFS, "writeFile")
        .mockImplementation((path, ...rest) =>
          String(path).endsWith(".discard")
            ? Promise.reject(new Error("ENOSPC"))
            : realWrite(path, ...rest),
        )

      await store.discardAll()
      write.mockRestore()

      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().discarded).toBe(1)
    })

    it("keeps refusing reads for the rest of the process when neither the marker nor the unlink succeeded", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const realWrite = RNFS.writeFile
      const write = jest
        .spyOn(RNFS, "writeFile")
        .mockImplementation((path, ...rest) =>
          String(path).endsWith(".discard")
            ? Promise.reject(new Error("ENOSPC"))
            : realWrite(path, ...rest),
        )
      const unlink = failDirectoryUnlink()
      await store.discardAll().catch(() => undefined)
      write.mockRestore()

      // No marker on disk, and the records are still there — but the store remembers.
      expect(mockFs.__mockFilePaths()).not.toContain(`${DIR}/.discard`)
      expect(await store.hasPendingDiscard()).toBe(true)
      await expect(store.pending()).rejects.toThrow("did not finish")
      unlink.mockRestore()

      expect(await store.pending()).toEqual([])
    })

    /**
     * The third review's MEDIUM: the discard's signals must exist before its first
     * filesystem call can fail, or a failure there leaves the pre-suppression records
     * readable by the next grant.
     */
    it("discards even when the directory's first exists() rejects", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const exists = jest.spyOn(RNFS, "exists").mockRejectedValueOnce(new Error("EIO"))

      await store.discardAll()
      exists.mockRestore()

      expect(await store.pending()).toEqual([])
      expect(await store.hasPendingDiscard()).toBe(false)
    })

    it("discards even when the directory cannot be enumerated", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const readDir = jest.spyOn(RNFS, "readDir").mockRejectedValue(new Error("EIO"))

      await store.discardAll()
      readDir.mockRestore()

      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().discarded).toBe(0) // uncountable, but gone
    })

    it("keeps the owed signal when the filesystem fails throughout, and finishes on the next read", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const exists = jest.spyOn(RNFS, "exists").mockRejectedValue(new Error("EIO"))

      await expect(store.discardAll()).rejects.toThrow()
      expect(await store.hasPendingDiscard()).toBe(true)
      exists.mockRestore()

      expect(await store.pending()).toEqual([])
      expect(await store.hasPendingDiscard()).toBe(false)
    })

    it("does not drain what a failed discard left behind, even under Enhanced", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      const unlink = failDirectoryUnlink()
      await store.discardAll().catch(() => undefined)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      await drainOutbox(store, instantly).catch(() => undefined)
      unlink.mockRestore()

      expect(submit).not.toHaveBeenCalled()
    })

    it("reports a marker the last run left behind, so the discard is re-run (AD-26)", async () => {
      // A discard that died between writing the marker and finishing the unlink.
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      await RNFS.writeFile(`${DIR}/.discard`, "1", "utf8")

      expect(await store.hasPendingDiscard()).toBe(true)

      await store.discardAll()
      expect(await store.hasPendingDiscard()).toBe(false)
      expect(await store.pending()).toEqual([])
    })

    it("counts what the discard threw away", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())
      await store.enqueue(record())

      await store.discardAll()

      expect(getOutboxCounters().discarded).toBe(2)
    })
  })

  describe("A2.3 — one record per settlement, whatever the SDK re-delivers", () => {
    it("ignores a second callback for the same payment", async () => {
      const store = createOutboxStore(DIR)
      const first = record({ sdkPaymentId: "sdk-repeat" })
      await store.enqueue(first)
      await store.enqueue(record({ sdkPaymentId: "sdk-repeat" }))

      const pending = await store.pending()
      expect(pending).toHaveLength(1)
      expect(pending[0].telemetryEventId).toBe(first.telemetryEventId)
      expect(getOutboxCounters().deduplicated).toBe(1)
    })

    it("keeps unkeyed events distinct, because they cannot be deduplicated", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ sdkPaymentId: null }))
      await store.enqueue(record({ sdkPaymentId: null }))

      expect(await store.pending()).toHaveLength(2)
    })

    it("still refuses a replay after the record was acknowledged and cleaned", async () => {
      // The SDK can re-deliver a settlement after the record that carried it is gone — a
      // resync after a restart, a listener re-attached. A fresh id at that point is a row
      // the warehouse cannot collapse, so the acknowledged payment id is kept as a
      // tombstone for the TTL.
      const store = createOutboxStore(DIR)
      const first = record({ sdkPaymentId: "sdk-replayed" })
      await store.enqueue(first)
      await store.acknowledge(first, store.lease())
      expect(await store.pending()).toEqual([])

      await store.enqueue(record({ sdkPaymentId: "sdk-replayed" }))

      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().deduplicated).toBe(1)
    })

    it("keeps that refusal across a store recreated after a restart", async () => {
      const first = record({ sdkPaymentId: "sdk-replayed-later" })
      const before = createOutboxStore(DIR)
      await before.enqueue(first)
      await before.acknowledge(first, before.lease())

      const after = createOutboxStore(DIR)
      await after.enqueue(record({ sdkPaymentId: "sdk-replayed-later" }))

      expect(await after.pending()).toEqual([])
    })

    it("writes the tombstone before it removes the record, so a crash between the two leaves both", async () => {
      // The other order has a window in which neither survives, and the next replay
      // mints a second `telemetry_event_id` for a settlement already delivered.
      const store = createOutboxStore(DIR)
      const first = record({ sdkPaymentId: "sdk-crash-mid-ack" })
      await store.enqueue(first)
      const unlink = jest.spyOn(RNFS, "unlink").mockRejectedValue(new Error("EIO"))

      await store.acknowledge(first, store.lease())
      unlink.mockRestore()

      const paths = mockFs.__mockFilePaths().filter((path) => path.startsWith(DIR))
      expect(paths).toContain(`${DIR}/acked.json`)
      expect(paths).toContain(`${DIR}/p-sdk-crash-mid-ack.json`)
    })

    it("removes a record whose tombstone exists without resubmitting it, and still refuses its replay", async () => {
      const first = record({ sdkPaymentId: "sdk-crash-mid-ack" })
      const before = createOutboxStore(DIR)
      await before.enqueue(first)
      const unlink = jest.spyOn(RNFS, "unlink").mockRejectedValue(new Error("EIO"))
      await before.acknowledge(first, before.lease())
      unlink.mockRestore()

      // The process died; the store is recreated. The record file is still there.
      const after = createOutboxStore(DIR)
      expect(await after.pending()).toEqual([])
      await after.enqueue(record({ sdkPaymentId: "sdk-crash-mid-ack" }))

      expect(await after.pending()).toEqual([])
      expect(mockFs.__mockFilePaths()).not.toContain(`${DIR}/p-sdk-crash-mid-ack.json`)
    })

    it("keeps the record when the tombstone cannot be written, so nothing is delivered twice under a new id", async () => {
      const store = createOutboxStore(DIR)
      const first = record({ sdkPaymentId: "sdk-no-tombstone" })
      await store.enqueue(first)
      const realWrite = RNFS.writeFile
      const write = jest
        .spyOn(RNFS, "writeFile")
        .mockImplementation((path, ...rest) =>
          String(path).includes("acked.json")
            ? Promise.reject(new Error("ENOSPC"))
            : realWrite(path, ...rest),
        )

      await expect(store.acknowledge(first, store.lease())).rejects.toThrow("ENOSPC")
      write.mockRestore()

      // Still queued under its original id; a replay is deduplicated against it.
      await store.enqueue(record({ sdkPaymentId: "sdk-no-tombstone" }))
      const pending = await store.pending()
      expect(pending).toHaveLength(1)
      expect(pending[0].telemetryEventId).toBe(first.telemetryEventId)
    })

    it("serialises two instances over the same directory, so neither loses the other's tombstones", async () => {
      // The provider's active store and the FR-25 sweep can both exist for one directory.
      const one = createOutboxStore(DIR)
      const two = createOutboxStore(DIR)
      const a = record({ sdkPaymentId: "sdk-instance-a" })
      const b = record({ sdkPaymentId: "sdk-instance-b" })
      await one.enqueue(a)
      await two.enqueue(b)

      await Promise.all([
        one.acknowledge(a, one.lease()),
        two.acknowledge(b, two.lease()),
      ])

      await one.enqueue(record({ sdkPaymentId: "sdk-instance-a" }))
      await two.enqueue(record({ sdkPaymentId: "sdk-instance-b" }))
      expect(await createOutboxStore(DIR).pending()).toEqual([])
      expect(getOutboxCounters().deduplicated).toBe(2)
    })

    it("forgets a tombstone once it is older than the TTL", async () => {
      const store = createOutboxStore(DIR)
      const first = record({ sdkPaymentId: "sdk-ancient" })
      await store.enqueue(first)
      await store.acknowledge(first, store.lease())
      const clock = jest
        .spyOn(Date, "now")
        .mockReturnValue(Date.now() + OUTBOX_TTL_MS + 1_000)

      await store.enqueue(record({ sdkPaymentId: "sdk-ancient" }))

      const pending = await createOutboxStore(DIR).pending()
      clock.mockRestore()
      expect(pending).toHaveLength(1)
    })

    it("never writes the SDK payment id into a payload (FR-24)", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ sdkPaymentId: "sdk-secret" }))

      const [pending] = await store.pending()
      expect(JSON.stringify(pending.payload)).not.toContain("sdk-secret")
    })
  })

  describe("AD-18 / AD-26 — bounded, and every loss is counted by its cause", () => {
    it("derives capacity from the formula, not a guess", () => {
      // ceil(p99 × 100): the placeholder p99 is 5 until Q14 is measured.
      expect(OUTBOX_MAX_RECORDS).toBe(500)
    })

    it("expires a record past its 72h TTL", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.enqueue(record())

      expect(await store.pending()).toHaveLength(1)
      expect(getOutboxCounters().expired).toBe(1)
      expect(await store.unreportedLoss()).toMatchObject({ expired: 1 })
    })

    it("expires a record written under a contract version the relay no longer takes (AD-30)", async () => {
      const store = createOutboxStore(DIR)
      // Current version is 1; n−1 is tolerated; anything older is not.
      await store.enqueue(record({ version: -1 }))
      await store.enqueue(record({ version: 0 }))

      expect(await store.pending()).toHaveLength(1)
      expect(getOutboxCounters().expired).toBe(1)
    })

    it("evicts oldest-first at capacity, and counts it apart from expiry", async () => {
      const store = createOutboxStore(DIR)
      const oldest = record({ queuedAt: Date.now() - OUTBOX_TTL_MS + 1_000 })
      await store.enqueue(oldest)
      for (let i = 0; i < OUTBOX_MAX_RECORDS - 1; i += 1) {
        await store.enqueue(record({ queuedAt: Date.now() - 60_000 + i }))
      }

      await store.enqueue(record({ queuedAt: Date.now() }))

      const pending = await store.pending()
      expect(pending).toHaveLength(OUTBOX_MAX_RECORDS)
      expect(pending.map((r) => r.telemetryEventId)).not.toContain(
        oldest.telemetryEventId,
      )
      expect(getOutboxCounters()).toMatchObject({ evicted: 1, expired: 0 })
      expect(await store.unreportedLoss()).toMatchObject({ evicted: 1, expired: 0 })
    })

    it("counts a record it cannot read as parse_failed and deletes it", async () => {
      await RNFS.writeFile(`${DIR}/p-corrupt.json`, "{ not json", "utf8")

      const store = createOutboxStore(DIR)
      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().parseFailed).toBe(1)
      expect(await store.unreportedLoss()).toMatchObject({ parseFailed: 1 })
      expect(
        mockFs.__mockFilePaths().some((path) => path.endsWith("p-corrupt.json")),
      ).toBe(false)
    })
  })

  describe("NFR-R1 — a record outlives the process that wrote it", () => {
    it("returns a record mid-flight when the process died to queued", () => {
      const stored = JSON.stringify(record({ state: OutboxState.Submitted }))

      expect(parseOutboxRecord(stored)?.state).toBe(OutboxState.Queued)
    })

    it("keeps the same id across that retry, so a resubmission deduplicates", async () => {
      const store = createOutboxStore(DIR)
      const original = record()
      await store.enqueue(original)
      await store.markSubmitted(original, store.lease())

      const [recovered] = await createOutboxStore(DIR).pending()
      expect(recovered.telemetryEventId).toBe(original.telemetryEventId)
    })

    it("reads a record from before the version field as version 1", () => {
      const legacy = record()
      const { version: _dropped, ...withoutVersion } = legacy

      expect(parseOutboxRecord(JSON.stringify(withoutVersion))?.version).toBe(1)
    })
  })

  describe("AD-27 — the port", () => {
    it("acknowledges and remembers, and nothing leaves the process", async () => {
      const transport = createLocalOnlyTransport()
      const payload: ContractPayload = {
        event: TelemetryEvent.ReferralCompleted,
        version: 1,
        params: {},
      }

      const result = await transport.submit(payload)

      expect(result.kind).toBe("acknowledged")
      expect(transport.entries().map((entry) => entry.payload)).toEqual([payload])
      expect(transport.ackSemantics).toBe("application")
      expect(transport.attachesNoImplicitIdentity).toBe(true)
    })
  })
})

describe("the telemetry outbox — the drain", () => {
  beforeEach(resetEverything)

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("the drain", () => {
    const enqueueAll = async (
      store: ReturnType<typeof createOutboxStore>,
      count: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        await store.enqueue(record({ queuedAt: Date.now() - (count - i) * 1_000 }))
      }
    }

    it("submits nothing while no transport is registered", async () => {
      const store = createOutboxStore(DIR)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(await store.pending()).toHaveLength(1)
    })

    it("cleans a record the receiver acknowledged", async () => {
      const store = createOutboxStore(DIR)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(submit).toHaveBeenCalledTimes(1)
      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().acknowledged).toBe(1)
    })

    it("treats a hand-off as acknowledged, collapsing the two states (FR-64)", async () => {
      const store = createOutboxStore(DIR)
      transportReturning({ kind: "handed_off" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(await store.pending()).toEqual([])
    })

    it("hands the adapter a contract payload — name, version, params — and never the row (AD-4)", async () => {
      const store = createOutboxStore(DIR)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record({ sdkPaymentId: "sdk-secret" }))

      await drainOutbox(store, instantly)

      const [payload] = submit.mock.calls[0]
      expect(payload.event).toBe(TelemetryEvent.PaymentSettled)
      expect(payload.version).toBe(1)
      expect(Object.keys(payload.params).sort()).toEqual([
        "direction",
        "event_version",
        "rail_type",
        "telemetry_event_id",
        "wallet_provider",
      ])
      expect(JSON.stringify(payload)).not.toContain("sdk-secret")
    })

    it("counts a permanent rejection as loss rather than retrying it forever", async () => {
      const store = createOutboxStore(DIR)
      transportReturning({ kind: "rejected", reason: "schema" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().rejected).toBe(1)
      expect(await store.unreportedLoss()).toMatchObject({ rejected: 1 })
      expect(getDiagnosticCounters().drainRejected).toBe(1)
    })

    describe("AD-26 — backoff on retryable, one drain per account", () => {
      it("requeues, stops the drain, and backs off from 5 s", async () => {
        const store = createOutboxStore(DIR)
        const submit = transportReturning({ kind: "retryable" })
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 3)
        let clock = 1_000_000
        const now = () => clock

        await drainOutbox(store, { ...instantly, now })
        expect(submit).toHaveBeenCalledTimes(1)
        expect(await store.pending()).toHaveLength(3)

        // Inside the backoff window: nothing is submitted.
        clock += DRAIN_BACKOFF_INITIAL_MS - 1
        await drainOutbox(store, { ...instantly, now })
        expect(submit).toHaveBeenCalledTimes(1)

        // Past it: the drain runs again.
        clock += 2
        await drainOutbox(store, { ...instantly, now })
        expect(submit).toHaveBeenCalledTimes(2)
      })

      it("honours the adapter's retryAfterMs over its own schedule", async () => {
        const store = createOutboxStore(DIR)
        const submit = transportReturning({ kind: "retryable", retryAfterMs: 60_000 })
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await store.enqueue(record())
        let clock = 1_000_000
        const now = () => clock

        await drainOutbox(store, { ...instantly, now })
        clock += DRAIN_BACKOFF_INITIAL_MS + 1
        await drainOutbox(store, { ...instantly, now })
        expect(submit).toHaveBeenCalledTimes(1)

        clock += 60_000
        await drainOutbox(store, { ...instantly, now })
        expect(submit).toHaveBeenCalledTimes(2)
      })

      it("resets the backoff once the receiver acknowledges again", async () => {
        const store = createOutboxStore(DIR)
        let failing = true
        const submit = transportReturning(() =>
          failing ? { kind: "retryable" } : acked(),
        )
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 2)
        let clock = 1_000_000
        const now = () => clock

        await drainOutbox(store, { ...instantly, now })
        failing = false
        clock += DRAIN_BACKOFF_INITIAL_MS + 1
        await drainOutbox(store, { ...instantly, now })
        expect(await store.pending()).toEqual([])

        // A fresh failure starts from 5 s again, not from where the doubling left off.
        failing = true
        await store.enqueue(record())
        await drainOutbox(store, { ...instantly, now })
        clock += DRAIN_BACKOFF_INITIAL_MS + 1
        await drainOutbox(store, { ...instantly, now })
        expect(submit.mock.calls.length).toBeGreaterThanOrEqual(4)
      })

      it("runs one drain per account at a time — a second trigger joins the first", async () => {
        const store = createOutboxStore(DIR)
        let release: () => void = () => {}
        const held = new Promise<SubmitResult>((resolve) => {
          release = () => resolve(acked())
        })
        const submit = jest.fn(() => held)
        registerTelemetryTransport({
          name: "slow",
          ackSemantics: "application",
          attachesNoImplicitIdentity: true,
          submit,
        })
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await store.enqueue(record())

        const first = drainOutbox(store, instantly)
        const second = drainOutbox(store, instantly)
        expect(second).toBe(first)

        release()
        await first
        expect(submit).toHaveBeenCalledTimes(1)
      })
    })

    it("submits one payload at a time, never a batch (AD-22)", async () => {
      const store = createOutboxStore(DIR)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await enqueueAll(store, 3)

      await drainOutbox(store, instantly)

      expect(submit).toHaveBeenCalledTimes(3)
      for (const [payload] of submit.mock.calls) {
        expect(Array.isArray(payload)).toBe(false)
      }
    })

    describe("FR-72 — arrival order must not reconstruct settlement order", () => {
      it("does not submit in the order events settled", async () => {
        const store = createOutboxStore(DIR)
        const submit = transportReturning(acked)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 4)

        const queued = (await store.pending()).map((r) => r.telemetryEventId)
        const random = jest.spyOn(Math, "random").mockReturnValue(0)
        await drainOutbox(store, instantly)
        random.mockRestore()

        const arrived = submit.mock.calls.map(
          ([payload]) => payload.params.telemetry_event_id,
        )
        expect(arrived).toHaveLength(4)
        expect(arrived).not.toEqual(queued)
        expect([...arrived].sort()).toEqual([...queued].sort())
      })

      it("pauses between submissions rather than emptying the queue in one burst", async () => {
        const store = createOutboxStore(DIR)
        transportReturning(acked)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 3)

        const delay = jest.fn(() => Promise.resolve())
        await drainOutbox(store, { delay })

        expect(delay).toHaveBeenCalledTimes(3)
      })
    })

    describe("AD-5 — the drain is gated too", () => {
      it.each([
        { mode: TelemetryMode.Anon },
        { mode: TelemetryMode.Unresolved },
        { mode: TelemetryMode.Custodial },
      ])("submits nothing under $mode", async ({ mode }) => {
        const store = createOutboxStore(DIR)
        const submit = transportReturning(acked)
        await store.enqueue(record())

        await resolveTelemetryMode(mode)
        await drainOutbox(store, instantly)
        expect(submit).not.toHaveBeenCalled()

        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await drainOutbox(store, instantly)
        expect(submit).toHaveBeenCalledTimes(1)
      })

      it("waits for a mode transition to finish discarding before it drains", async () => {
        const store = createOutboxStore(DIR)
        const submit = transportReturning(acked)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 2)

        let release = () => {}
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        onTelemetrySuppressed(async () => {
          await held
          await store.discardAll()
        })

        resolveTelemetryMode(TelemetryMode.Anon)
        const backToEnhanced = resolveTelemetryMode(TelemetryMode.Enhanced)

        const drained = drainOutbox(store, instantly)
        release()
        await backToEnhanced
        await drained

        expect(submit).not.toHaveBeenCalled()
        expect(await store.pending()).toEqual([])
      })

      it("does not submit a record whose mode closed during the write before it", async () => {
        // `markSubmitted` is a disk write. A switch to incognito during that await closes
        // the gate synchronously while the iteration is already past its first check; a
        // submit after that is the one event FR-5's discard cannot unsend.
        const base = createOutboxStore(DIR)
        const submit = transportReturning(acked)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await base.enqueue(record())

        const store = {
          ...base,
          markSubmitted: async (r: OutboxRecord, lease: number) => {
            const applied = await base.markSubmitted(r, lease)
            resolveTelemetryMode(TelemetryMode.Anon)
            return applied
          },
        }

        await drainOutbox(store, instantly)

        expect(submit).not.toHaveBeenCalled()
      })

      it("stops mid-drain when the mode changes under it", async () => {
        const store = createOutboxStore(DIR)
        const submit = jest.fn(async () => {
          resolveTelemetryMode(TelemetryMode.Anon)
          return acked()
        })
        registerTelemetryTransport({
          name: "test",
          ackSemantics: "application",
          attachesNoImplicitIdentity: true,
          submit,
        })
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 3)

        await drainOutbox(store, instantly)

        expect(submit).toHaveBeenCalledTimes(1)
      })
    })

    describe("a result that arrives after the queue it came from was discarded", () => {
      /**
       * The third review's HIGH. The submit is held open; the mode switches to incognito
       * and the discard runs to completion; only then does the transport answer. Whatever
       * it answers, nothing may be written: not the record (`retryable`), not its loss
       * (`rejected`), not its tombstone (`acknowledged`, `handed_off`). Any of those
       * would recreate the directory, and a later grant would drain what the switch
       * destroyed (FR-5).
       */
      const results: Record<string, () => SubmitResult> = {
        retryable: () => ({ kind: "retryable" }),
        rejected: () => ({ kind: "rejected", reason: "schema" }),
        acknowledged: acked,
        handed_off: () => ({ kind: "handed_off" }),
      }

      const holdSubmit = () => {
        let answer: (result: SubmitResult) => void = () => undefined
        const submit = jest.fn(
          () =>
            new Promise<SubmitResult>((resolve) => {
              answer = resolve
            }),
        )
        registerTelemetryTransport({
          name: "test",
          ackSemantics: "application",
          attachesNoImplicitIdentity: true,
          submit,
        })
        return { submit, answer: (result: SubmitResult) => answer(result) }
      }

      const filesUnder = () =>
        mockFs.__mockFilePaths().filter((path) => path.startsWith(DIR))

      it.each(Object.keys(results))(
        "writes nothing back on a %s that lands after Enhanced → Anon discarded the queue",
        async (kind) => {
          const store = createOutboxStore(DIR)
          const { submit, answer } = holdSubmit()
          await resolveTelemetryMode(TelemetryMode.Enhanced)
          const original = record({ sdkPaymentId: "sdk-in-flight" })
          await store.enqueue(original)
          onTelemetrySuppressed(() => store.discardAll())

          const drain = drainOutbox(store, instantly)
          await settled()
          expect(submit).toHaveBeenCalledTimes(1)

          await resolveTelemetryMode(TelemetryMode.Anon) // the discard has completed
          expect(filesUnder()).toEqual([])
          answer(results[kind]())
          await drain

          expect(await store.pending()).toEqual([])
          expect(filesUnder()).toEqual([])
          expect(getOutboxCounters().staleWrites).toBeGreaterThanOrEqual(1)
        },
      )

      it.each(Object.keys(results))(
        "writes nothing back on a %s even when the mode is Enhanced again by the time it lands",
        async (kind) => {
          // A mode check alone cannot catch this: Enhanced → Anon → Enhanced has completed
          // and the current mode says yes. The generation says no.
          const store = createOutboxStore(DIR)
          const { submit, answer } = holdSubmit()
          await resolveTelemetryMode(TelemetryMode.Enhanced)
          await store.enqueue(record({ sdkPaymentId: "sdk-in-flight" }))
          onTelemetrySuppressed(() => store.discardAll())

          const drain = drainOutbox(store, instantly)
          await settled()
          expect(submit).toHaveBeenCalledTimes(1)

          await resolveTelemetryMode(TelemetryMode.Anon)
          await resolveTelemetryMode(TelemetryMode.Enhanced)
          expect(isDrainPermitted()).toBe(true)
          answer(results[kind]())
          await drain

          expect(await store.pending()).toEqual([])
          expect(filesUnder()).toEqual([])
        },
      )

      it("does not mark the next record submitted either — the loop stops", async () => {
        const store = createOutboxStore(DIR)
        const { submit, answer } = holdSubmit()
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 3)
        onTelemetrySuppressed(() => store.discardAll())

        const drain = drainOutbox(store, instantly)
        await settled()
        await resolveTelemetryMode(TelemetryMode.Anon)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        answer(acked())
        await drain

        expect(submit).toHaveBeenCalledTimes(1)
        expect(filesUnder()).toEqual([])
      })

      it("takes its lease before the read, so a discard between the two leaves the lease stale", async () => {
        // The store hands back the records and *then* a discard is requested — the
        // window between `lease()` and `pending()` resolving. The records are real, the
        // queue they came from is already condemned, and nothing may be written back.
        const base = createOutboxStore(DIR)
        const submit = transportReturning(acked)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await base.enqueue(record())
        const store = {
          ...base,
          pending: async () => {
            const records = await base.pending()
            base.discardAll().catch(() => undefined)
            return records
          },
        }

        await drainOutbox(store, instantly)

        // Not submitted either: a record whose queue was condemned before it was marked
        // is a withheld event, and sending it is the flush FR-5 forbids.
        expect(submit).not.toHaveBeenCalled()
        expect(filesUnder()).toEqual([])
        expect(getOutboxCounters().staleWrites).toBeGreaterThanOrEqual(1)
      })

      it("does not let a stale retryable's backoff delay the successor queue", async () => {
        const store = createOutboxStore(DIR)
        const { submit, answer } = holdSubmit()
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await store.enqueue(record({ sdkPaymentId: "sdk-first-queue" }))
        onTelemetrySuppressed(() => store.discardAll())

        const drain = drainOutbox(store, instantly)
        await settled()
        await resolveTelemetryMode(TelemetryMode.Anon)
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        answer({ kind: "retryable", retryAfterMs: 60_000 })
        await drain

        // A new queue under the new grant drains at once; the old queue's "not now" was
        // never applied, so neither is its backoff.
        submit.mockImplementation(() => Promise.resolve(acked()))
        await store.enqueue(record({ sdkPaymentId: "sdk-second-queue" }))
        await drainOutbox(store, instantly)

        expect(submit).toHaveBeenCalledTimes(2)
        expect(await store.pending()).toEqual([])
      })

      it("still applies a result whose queue was not discarded (anchor)", async () => {
        const store = createOutboxStore(DIR)
        const { submit, answer } = holdSubmit()
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await store.enqueue(record({ sdkPaymentId: "sdk-in-flight" }))

        const drain = drainOutbox(store, instantly)
        await settled()
        expect(submit).toHaveBeenCalledTimes(1)
        answer({ kind: "retryable" })
        await drain

        const [pending] = await store.pending()
        expect(pending.state).toBe(OutboxState.Queued)
        expect(getOutboxCounters().staleWrites).toBe(0)
      })
    })
  })
})

describe("the telemetry outbox — loss and health", () => {
  beforeEach(resetEverything)

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("AD-31 — loss is a pipeline: counted, reported once per drain, settled on ack", () => {
    const lossSeen = (submit: jest.Mock<Promise<SubmitResult>, [ContractPayload]>) =>
      submit.mock.calls
        .map(([payload]) => payload)
        .filter((payload) => payload.event === TelemetryEvent.LossReported)

    it("reports accumulated loss as a contract event and settles it once acknowledged", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      // Two expiries and a rejection, before any report has gone.
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()

      await drainActiveOutbox()

      const [report] = lossSeen(submit)
      expect(report?.params).toMatchObject({
        wallet_provider: "spark",
        expired: 2,
        evicted: 0,
        rejected: 0,
        parse_failed: 0,
      })
      expect(await store.unreportedLoss()).toEqual({
        expired: 0,
        evicted: 0,
        rejected: 0,
        parseFailed: 0,
      } satisfies LossCounters)
    })

    it("reports nothing when there is no loss to report", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      const submit = transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainActiveOutbox()

      expect(lossSeen(submit)).toEqual([])
    })

    it("does not file a second report while the first is still queued", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      transportReturning({ kind: "retryable" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()

      await drainActiveOutbox()
      resetDrainStateForTesting()
      await drainActiveOutbox()

      const reports = (await store.pending()).filter(
        (r) => r.event === TelemetryEvent.LossReported,
      )
      expect(reports).toHaveLength(1)
    })

    it("keeps the loss on the device until the report is acknowledged", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      transportReturning({ kind: "retryable" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()

      await drainActiveOutbox()

      expect(await store.unreportedLoss()).toMatchObject({ expired: 1 })
    })

    it("never reports from a device required to emit zero (AD-13)", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      const submit = transportReturning(acked)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()
      await resolveTelemetryMode(TelemetryMode.Anon)

      await drainActiveOutbox()

      expect(submit).not.toHaveBeenCalled()
      expect(await store.pending()).toHaveLength(0)
    })
  })

  describe("FR-68 / AD-30 — the boundary's health is reachable, not just counted", () => {
    const breadcrumbs = () => mockCrashlyticsLog.mock.calls.flat()

    it("aggregates every loss source and the drain's own numbers into one snapshot", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      transportReturning(acked)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()

      await drainActiveOutbox()

      expect(getTelemetryHealth()).toMatchObject({
        expired: 1,
        evicted: 0,
        suppressedEvents: 0,
        dropped_unknown_field: 0,
        lastDrainDepth: 0,
      })
      expect(getTelemetryHealth().lastDrainDurationMs).toBeGreaterThanOrEqual(0)
    })

    it("surfaces the snapshot from a device permitted to report", async () => {
      setActiveOutbox(createOutboxStore(DIR))
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      await drainActiveOutbox()

      expect(breadcrumbs().some((line) => String(line).startsWith("[telemetry]"))).toBe(
        true,
      )
    })

    it("says nothing from a device required to emit zero (AD-13)", async () => {
      setActiveOutbox(createOutboxStore(DIR))
      await resolveTelemetryMode(TelemetryMode.Anon)

      await drainActiveOutbox()
      expect(breadcrumbs()).toEqual([])

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await drainActiveOutbox()
      expect(breadcrumbs().length).toBeGreaterThan(0)
    })

    it("repeats itself only when a number has moved", async () => {
      const store = createOutboxStore(DIR)
      setActiveOutbox(store)
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      await drainActiveOutbox()
      const first = breadcrumbs().length

      await drainActiveOutbox()
      expect(breadcrumbs()).toHaveLength(first)

      await store.enqueue(record())
      await drainActiveOutbox()
      expect(breadcrumbs().length).toBeGreaterThan(first)
    })
  })
})
