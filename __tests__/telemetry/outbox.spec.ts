/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import RNFS from "react-native-fs"

import {
  RailType,
  TelemetryDirection,
  TelemetryEvent,
  WalletProvider,
  type TelemetryPayload,
} from "@app/telemetry/contract"
import { resetDiagnosticsForTesting } from "@app/telemetry/diagnostics"
import {
  drainActiveOutbox,
  getTelemetryHealth,
  resetTelemetryHealthReportingForTesting,
  setActiveOutbox,
} from "@app/telemetry/index"
import {
  onTelemetrySuppressed,
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"
import { drainOutbox } from "@app/telemetry/outbox/drain"
import {
  OutboxState,
  parseOutboxRecord,
  type OutboxRecord,
} from "@app/telemetry/outbox/record"
import {
  createOutboxStore,
  getOutboxCounters,
  OUTBOX_MAX_RECORDS,
  OUTBOX_TTL_MS,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"
import {
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
  type TransportResult,
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

const DIR = "/mock/documents/blink-telemetry-outbox-regtest/account-1"

let minted = 0
const record = (overrides: Partial<OutboxRecord> = {}): OutboxRecord => {
  minted += 1
  return {
    telemetryEventId: `3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7${String(minted).padStart(2, "0")}`,
    event: TelemetryEvent.PaymentSettled,
    payload: {
      event_version: 1,
      wallet_provider: WalletProvider.Spark,
      direction: TelemetryDirection.Send,
      rail_type: RailType.Lightning,
      telemetry_event_id: `3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7${String(minted).padStart(2, "0")}`,
    },
    sdkPaymentId: `sdk-${minted}`,
    queuedAt: Date.now(),
    state: OutboxState.Queued,
    ...overrides,
  }
}

const acceptingTransport = (result: TransportResult = { outcome: "acknowledged" }) => {
  const submit = jest.fn<Promise<TransportResult>, [TelemetryEvent, TelemetryPayload]>(
    () => Promise.resolve(result),
  )
  registerTelemetryTransport({
    name: "test",
    attachesPerEventIdentity: false,
    submit,
  })
  return submit
}

const instantly = { delay: () => Promise.resolve() }

describe("the telemetry outbox", () => {
  beforeEach(() => {
    minted = 0
    mockFs.__resetMockFileSystem()
    resetOutboxCountersForTesting()
    resetTelemetryModeForTesting()
    resetTelemetryTransportForTesting()
    resetDiagnosticsForTesting()
    resetTelemetryHealthReportingForTesting()
    mockCrashlyticsLog.mockClear()
    setActiveOutbox(null)
  })

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("AD-6 — its own directory, and discard is an unlink of that directory alone", () => {
    it("writes nowhere near the wallet store", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      expect(mockFs.__mockFilePaths()).toHaveLength(1)
      expect(mockFs.__mockFilePaths()[0]).toContain("blink-telemetry-outbox-regtest")
      expect(mockFs.__mockFilePaths()[0]).not.toContain("breez-sdk-spark")
    })

    it("empties on discard, and is idempotent (FR-5)", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record())

      await store.discardAll()
      expect(await store.pending()).toEqual([])

      // Neither unlink nor a per-file delete is atomic, so an interrupted discard is
      // finished on the next activation rather than resumed.
      await expect(store.discardAll()).resolves.toBeUndefined()
      expect(await store.pending()).toEqual([])
    })

    it("discards without a directory ever having existed", async () => {
      await expect(createOutboxStore(DIR).discardAll()).resolves.toBeUndefined()
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
      // Inventing a key out of payment data to make these look deduplicable is exactly the
      // derivation §5.5 forbids, so two of them are genuinely two rows.
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ sdkPaymentId: null }))
      await store.enqueue(record({ sdkPaymentId: null }))

      expect(await store.pending()).toHaveLength(2)
    })

    it("never writes the SDK payment id into a payload (FR-24)", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ sdkPaymentId: "sdk-secret" }))

      const [pending] = await store.pending()
      expect(JSON.stringify(pending.payload)).not.toContain("sdk-secret")
    })
  })

  describe("AD-18 — bounded, and its bound is counted", () => {
    it("expires a record past its 72h TTL", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.enqueue(record())

      expect(await store.pending()).toHaveLength(1)
      expect(getOutboxCounters().expired).toBe(1)
    })

    it("evicts oldest-first at capacity, and counts it apart from expiry", async () => {
      const store = createOutboxStore(DIR)
      // Inside the TTL, so what leaves is pressure rather than age — the two outcomes CM-5
      // has to tell apart.
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
      await store.markSubmitted(original)

      const [recovered] = await createOutboxStore(DIR).pending()
      expect(recovered.telemetryEventId).toBe(original.telemetryEventId)
    })

    it("drops a record it cannot read rather than guessing at it", async () => {
      await RNFS.writeFile(`${DIR}/p-corrupt.json`, "{ not json", "utf8")

      expect(await createOutboxStore(DIR).pending()).toEqual([])
    })
  })

  describe("FR-68 — the loss the pipeline causes is reachable, not just counted", () => {
    const breadcrumbs = () => mockCrashlyticsLog.mock.calls.flat()

    it("aggregates every loss source into one snapshot", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(record({ queuedAt: Date.now() - OUTBOX_TTL_MS - 1 }))
      await store.pending()

      expect(getTelemetryHealth()).toMatchObject({
        expired: 1,
        evicted: 0,
        suppressedEvents: 0,
        dropped_unknown_field: 0,
      })
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

      // Anchor: the same call does report once the mode permits diagnostics, so the
      // silence above is AD-13 and not a drain that never ran.
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

      // The record is held, not lost: OD-1 is open, and the cost of that is a queue rather
      // than a silence.
      expect(await store.pending()).toHaveLength(1)
    })

    it("cleans a record the receiver acknowledged", async () => {
      const store = createOutboxStore(DIR)
      const submit = acceptingTransport()
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(submit).toHaveBeenCalledTimes(1)
      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().acknowledged).toBe(1)
    })

    it("retries a record the transport could not take", async () => {
      const store = createOutboxStore(DIR)
      acceptingTransport({ outcome: "unavailable" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(await store.pending()).toHaveLength(1)
      expect(getOutboxCounters().acknowledged).toBe(0)
    })

    it("counts a permanent rejection as loss rather than retrying it forever", async () => {
      const store = createOutboxStore(DIR)
      acceptingTransport({ outcome: "rejected", reason: "schema" })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record())

      await drainOutbox(store, instantly)

      expect(await store.pending()).toEqual([])
      expect(getOutboxCounters().rejected).toBe(1)
    })

    it("hands the adapter a payload and never the outbox row (AD-4)", async () => {
      const store = createOutboxStore(DIR)
      const submit = acceptingTransport()
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await store.enqueue(record({ sdkPaymentId: "sdk-secret" }))

      await drainOutbox(store, instantly)

      const [event, payload] = submit.mock.calls[0]
      expect(event).toBe(TelemetryEvent.PaymentSettled)
      expect(Object.keys(payload).sort()).toEqual([
        "direction",
        "event_version",
        "rail_type",
        "telemetry_event_id",
        "wallet_provider",
      ])
    })

    it("submits one payload at a time, never a batch (AD-22)", async () => {
      const store = createOutboxStore(DIR)
      const submit = acceptingTransport()
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await enqueueAll(store, 3)

      await drainOutbox(store, instantly)

      expect(submit).toHaveBeenCalledTimes(3)
      for (const [, payload] of submit.mock.calls) {
        expect(Array.isArray(payload)).toBe(false)
      }
    })

    describe("FR-72 — arrival order must not reconstruct settlement order", () => {
      it("does not submit in the order events settled", async () => {
        const store = createOutboxStore(DIR)
        const submit = acceptingTransport()
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 4)

        const queued = (await store.pending()).map((r) => r.telemetryEventId)
        // Fisher-Yates with a pinned source, so the permutation is deterministic here and
        // random in production.
        const random = jest.spyOn(Math, "random").mockReturnValue(0)
        await drainOutbox(store, instantly)
        random.mockRestore()

        const arrived = submit.mock.calls.map(([, payload]) => payload.telemetry_event_id)
        expect(arrived).toHaveLength(4)
        expect(arrived).not.toEqual(queued)
        expect([...arrived].sort()).toEqual([...queued].sort())
      })

      it("pauses between submissions rather than emptying the queue in one burst", async () => {
        const store = createOutboxStore(DIR)
        acceptingTransport()
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
        const submit = acceptingTransport()
        await store.enqueue(record())

        await resolveTelemetryMode(mode)
        await drainOutbox(store, instantly)
        expect(submit).not.toHaveBeenCalled()

        // Anchor: the very same queue does drain once the mode permits it, so the silence
        // above is the gate's doing and not an empty store.
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await drainOutbox(store, instantly)
        expect(submit).toHaveBeenCalledTimes(1)
      })

      it("waits for a mode transition to finish discarding before it drains", async () => {
        // Anon → Enhanced leaves the previous mode's discard in flight while draining is
        // once again permitted. A drain reading the queue inside that window would submit
        // exactly the records the switch to incognito withheld.
        const store = createOutboxStore(DIR)
        const submit = acceptingTransport()
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

      it("stops mid-drain when the mode changes under it", async () => {
        const store = createOutboxStore(DIR)
        const submit = jest.fn(async () => {
          resolveTelemetryMode(TelemetryMode.Anon)
          return { outcome: "acknowledged" } as TransportResult
        })
        registerTelemetryTransport({
          name: "test",
          attachesPerEventIdentity: false,
          submit,
        })
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await enqueueAll(store, 3)

        await drainOutbox(store, instantly)

        expect(submit).toHaveBeenCalledTimes(1)
      })
    })
  })
})
