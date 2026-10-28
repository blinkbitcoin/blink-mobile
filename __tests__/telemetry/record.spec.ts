/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import { TelemetryEvent, WalletProvider } from "@app/telemetry/contract"
import { dedupKeyFor, OutboxState, parseOutboxRecord } from "@app/telemetry/outbox/record"

const UUID = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e701"

const stored = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    telemetryEventId: UUID,
    event: TelemetryEvent.PaymentSettled,
    version: 1,
    payload: {
      event_version: 1,
      wallet_provider: WalletProvider.Spark,
      telemetry_event_id: UUID,
    },
    sdkPaymentId: "sdk-1",
    queuedAt: 1_700_000_000_000,
    state: OutboxState.Submitted,
    ...overrides,
  })

describe("dedupKeyFor", () => {
  it("keys a payment on a digest of its id, so two settlements never share a file", () => {
    const a = dedupKeyFor({ sdkPaymentId: "sdk-a", telemetryEventId: UUID })
    const b = dedupKeyFor({ sdkPaymentId: "sdk-b", telemetryEventId: UUID })

    expect(a).toMatch(/^p-[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })

  it("gives the same payment the same file every time, which is what makes a replay cheap", () => {
    expect(dedupKeyFor({ sdkPaymentId: "sdk-a", telemetryEventId: UUID })).toBe(
      dedupKeyFor({ sdkPaymentId: "sdk-a", telemetryEventId: "different-id" }),
    )
  })

  it("falls back to the event's own id when there is no payment to key on", () => {
    expect(dedupKeyFor({ sdkPaymentId: null, telemetryEventId: UUID })).toBe(`e-${UUID}`)
  })
})

describe("parseOutboxRecord", () => {
  it("reads back a record it wrote, and returns anything mid-flight to queued", () => {
    const record = parseOutboxRecord(stored())

    expect(record).toMatchObject({
      telemetryEventId: UUID,
      event: TelemetryEvent.PaymentSettled,
      version: 1,
      sdkPaymentId: "sdk-1",
      queuedAt: 1_700_000_000_000,
      state: OutboxState.Queued,
    })
  })

  it("reads a record from before the version field as version 1", () => {
    expect(parseOutboxRecord(stored({ version: undefined }))?.version).toBe(1)
  })

  it("reads a missing payment id as none, rather than as the string it is not", () => {
    expect(parseOutboxRecord(stored({ sdkPaymentId: 7 }))?.sdkPaymentId).toBeNull()
  })

  it.each([
    { what: "text that is not JSON at all", raw: "{ not json" },
    { what: "JSON that is not an object", raw: '"a string"' },
    { what: "null", raw: "null" },
  ])("drops $what rather than guessing at it", ({ raw }) => {
    expect(parseOutboxRecord(raw)).toBeNull()
  })

  it.each([
    { field: "telemetryEventId", value: 7 },
    { field: "event", value: 7 },
    { field: "queuedAt", value: "yesterday" },
  ])("drops a record whose $field is the wrong type", ({ field, value }) => {
    expect(parseOutboxRecord(stored({ [field]: value }))).toBeNull()
  })

  it.each([
    { what: "is missing", payload: undefined },
    { what: "is not an object", payload: "flat" },
    { what: "holds a nested object", payload: { direction: { deep: true } } },
    { what: "holds an array", payload: { direction: ["send"] } },
    { what: "holds null", payload: { direction: null } },
  ])(
    "drops a record whose payload $what — only flat values are a payload",
    ({ payload }) => {
      expect(parseOutboxRecord(stored({ payload }))).toBeNull()
    },
  )

  it("keeps a payload of strings, numbers and booleans, which is all a payload may be", () => {
    const record = parseOutboxRecord(stored({ payload: { a: "text", b: 1, c: true } }))

    expect(record?.payload).toEqual({ a: "text", b: 1, c: true })
  })
})
