/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import RNFS from "react-native-fs"

import {
  createTelemetryRelayTransport,
  TELEMETRY_RELAY_PATH,
} from "@app/self-custodial/telemetry-relay"
import {
  applyServerKillSwitch,
  resetEnablementForTesting,
  setTelemetryRolloutEnabled,
} from "@app/telemetry/enablement"
import {
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"
import { drainOutbox, resetDrainStateForTesting } from "@app/telemetry/outbox/drain"
import { OutboxState, type OutboxRecord } from "@app/telemetry/outbox/record"
import {
  createOutboxStore,
  getOutboxCounters,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"
import {
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
} from "@app/telemetry/transport"
import { TelemetryEvent, WalletProvider, type ContractPayload } from "@app/telemetry"

const RELAY = "https://staging.blink.sv"
const UUID = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e701"

const payload: ContractPayload = {
  event: TelemetryEvent.PaymentSettled,
  version: 1,
  params: {
    event_version: 1,
    wallet_provider: WalletProvider.Spark,
    direction: "send",
    rail_type: "lightning",
    telemetry_event_id: UUID,
  },
}

const respond = (status: number, headers: Record<string, string> = {}) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
  } as Response)

describe("the relay adapter", () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()
  const transport = createTelemetryRelayTransport(RELAY)

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockReturnValue(respond(200))
  })

  it("declares what the boundary needs to know before it will use an adapter", () => {
    expect(transport.name).toBe("blink-relay")
    expect(transport.ackSemantics).toBe("application")
    expect(transport.attachesNoImplicitIdentity).toBe(true)
  })

  it("posts one approved payload to the relay, and adds nothing to it", async () => {
    await transport.submit(payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${RELAY}${TELEMETRY_RELAY_PATH}`)
    expect(init?.method).toBe("POST")
    // The body is what the policy stage approved and nothing else: no device id, no
    // session, no timestamps the payload did not already carry.
    expect(JSON.parse(String(init?.body))).toEqual(payload)
  })

  it("sends no header that could identify the device", async () => {
    await transport.submit(payload)

    const [, init] = fetchMock.mock.calls[0]
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(Object.keys(headers).sort()).toEqual(["Accept", "Content-Type"])
    // No bearer token, no App Check attestation, no installation id: anything the receiver
    // could join on would undo the whole boundary.
    expect(JSON.stringify(headers).toLowerCase()).not.toContain("authorization")
    expect(JSON.stringify(headers).toLowerCase()).not.toContain("firebase")
  })

  it.each([200, 201, 202])(
    "treats %s as acknowledged, so the record can be cleaned",
    async (status) => {
      fetchMock.mockReturnValue(respond(status))

      const result = await transport.submit(payload)

      expect(result).toMatchObject({ kind: "acknowledged" })
    },
  )

  it.each([400, 409, 422])(
    "treats %s as a permanent refusal — retrying a payload the relay will never take is pointless",
    async (status) => {
      fetchMock.mockReturnValue(respond(status))

      const result = await transport.submit(payload)

      expect(result).toMatchObject({ kind: "rejected" })
      expect((result as { reason: string }).reason).toContain(String(status))
    },
  )

  it.each([401, 403, 404, 408, 500, 502, 503])(
    "treats %s as worth another try later",
    async (status) => {
      fetchMock.mockReturnValue(respond(status))

      expect(await transport.submit(payload)).toEqual({ kind: "retryable" })
    },
  )

  it("does not read 'not deployed yet' as 'this event is unwelcome'", async () => {
    // A 404 counted as a rejection would book a deliverable event as loss, and the relay
    // does not exist yet.
    fetchMock.mockReturnValue(respond(404))

    expect(await transport.submit(payload)).toEqual({ kind: "retryable" })
  })

  it("honours the wait a throttled relay asks for", async () => {
    fetchMock.mockReturnValue(respond(429, { "Retry-After": "30" }))

    expect(await transport.submit(payload)).toEqual({
      kind: "retryable",
      retryAfterMs: 30_000,
    })
  })

  it("caps an unreasonable Retry-After rather than sitting out the day", async () => {
    fetchMock.mockReturnValue(respond(429, { "Retry-After": "86400" }))

    expect(await transport.submit(payload)).toEqual({
      kind: "retryable",
      retryAfterMs: 15 * 60 * 1000,
    })
  })

  it.each([
    { what: "a header that is not a number", value: "soon" },
    { what: "a negative wait", value: "-5" },
  ])("ignores $what and lets the drain pick its own backoff", async ({ value }) => {
    fetchMock.mockReturnValue(respond(429, { "Retry-After": value }))

    expect(await transport.submit(payload)).toEqual({ kind: "retryable" })
  })

  it("keeps the record when the device is offline", async () => {
    fetchMock.mockRejectedValue(new Error("Network request failed"))

    expect(await transport.submit(payload)).toEqual({ kind: "retryable" })
  })

  it("gives up on a relay that never answers, and keeps the record", async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementation((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")))
      })
    })

    const inFlight = transport.submit(payload)
    jest.advanceTimersByTime(10_000)
    const result = await inFlight
    jest.useRealTimers()

    expect(result).toEqual({ kind: "retryable" })
  })

  it("clears its timeout once the relay answers, so a drain leaves no timer behind", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")

    await transport.submit(payload)

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})

/**
 * The adapter behind the real outbox, rather than on its own: what a drain does with each
 * answer, and that the local payment key never reaches the relay.
 */
describe("the relay behind the outbox", () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()
  const DIR = "/mock/documents/blink-telemetry-outbox-regtest/account-relay"

  const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

  const record = (sdkPaymentId: string | null): OutboxRecord => ({
    telemetryEventId: UUID,
    event: TelemetryEvent.PaymentSettled,
    version: 1,
    payload: payload.params,
    sdkPaymentId,
    queuedAt: Date.now(),
    state: OutboxState.Queued,
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    mockFs.__resetMockFileSystem()
    resetOutboxCountersForTesting()
    resetDrainStateForTesting()
    resetTelemetryModeForTesting()
    resetEnablementForTesting()
    resetTelemetryTransportForTesting()
    setTelemetryRolloutEnabled(true)
    registerTelemetryTransport(createTelemetryRelayTransport(RELAY))
    await resolveTelemetryMode(TelemetryMode.Enhanced)
  })

  it("delivers a queued event and cleans it once the relay confirms", async () => {
    fetchMock.mockReturnValue(respond(202))
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-1"))

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await store.pending()).toEqual([])
  })

  it("never puts the local payment key on the wire", async () => {
    fetchMock.mockReturnValue(respond(202))
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-secret-key"))

    await drainOutbox(store, { delay: () => Promise.resolve() })

    const [, init] = fetchMock.mock.calls[0]
    expect(String(init?.body)).not.toContain("sdk-secret-key")
    expect(JSON.parse(String(init?.body))).toEqual({
      event: TelemetryEvent.PaymentSettled,
      version: 1,
      params: payload.params,
    })
  })

  it("keeps the event queued when the relay is not there yet", async () => {
    fetchMock.mockReturnValue(respond(404))
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-2"))

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(await store.pending()).toHaveLength(1)
    expect(getOutboxCounters().rejected).toBe(0)
  })

  it("counts a payload the relay refuses outright as loss, and stops retrying it", async () => {
    fetchMock.mockReturnValue(respond(422))
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-3"))

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(await store.pending()).toEqual([])
    expect(getOutboxCounters().rejected).toBe(1)
    expect(await store.unreportedLoss()).toMatchObject({ rejected: 1 })
  })

  it("sends nothing at all from an incognito device, whatever is queued", async () => {
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-4"))
    await resolveTelemetryMode(TelemetryMode.Anon)

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends nothing until the rollout flag is on", async () => {
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-5"))
    resetEnablementForTesting()

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("stops sending the moment the kill switch engages", async () => {
    fetchMock.mockReturnValue(respond(202))
    const store = createOutboxStore(DIR)
    await store.enqueue(record("sdk-relay-6"))
    applyServerKillSwitch(false)

    await drainOutbox(store, { delay: () => Promise.resolve() })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
