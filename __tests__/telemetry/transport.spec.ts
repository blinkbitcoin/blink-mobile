/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  TelemetryEvent,
  WalletProvider,
  type ContractPayload,
} from "@app/telemetry/contract"
import {
  createLocalOnlyTransport,
  getTelemetryTransport,
  LOCAL_ONLY_RING_SIZE,
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
} from "@app/telemetry/transport"

const payload = (id: number): ContractPayload => ({
  event: TelemetryEvent.PaymentSettled,
  version: 1,
  params: {
    event_version: 1,
    wallet_provider: WalletProvider.Spark,
    telemetry_event_id: `3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e${String(id).padStart(3, "0")}`,
  },
})

describe("the transport port", () => {
  beforeEach(resetTelemetryTransportForTesting)

  it("has nothing behind it until an adapter registers", () => {
    expect(getTelemetryTransport()).toBeNull()
  })

  it("hands the drain whichever adapter registered last", () => {
    const first = createLocalOnlyTransport()
    const second = createLocalOnlyTransport()

    registerTelemetryTransport(first)
    registerTelemetryTransport(second)

    expect(getTelemetryTransport()).toBe(second)
  })
})

describe("the local-only adapter", () => {
  it("declares what the boundary needs to know about it", () => {
    const transport = createLocalOnlyTransport()

    expect(transport.name).toBe("local-only")
    expect(transport.ackSemantics).toBe("application")
    expect(transport.attachesNoImplicitIdentity).toBe(true)
  })

  it("acknowledges what it is handed and keeps it where the developer screen can read it", async () => {
    const transport = createLocalOnlyTransport()

    const result = await transport.submit(payload(1))

    expect(result.kind).toBe("acknowledged")
    expect(transport.entries()).toHaveLength(1)
    expect(transport.entries()[0].payload).toEqual(payload(1))
  })

  it("keeps only the most recent entries, so a long session cannot grow it forever", async () => {
    const transport = createLocalOnlyTransport()

    for (let i = 0; i < LOCAL_ONLY_RING_SIZE + 5; i += 1) {
      await transport.submit(payload(i))
    }

    const entries = transport.entries()
    expect(entries).toHaveLength(LOCAL_ONLY_RING_SIZE)
    // The first five fell off the front, not the back.
    expect(entries[0].payload.params.telemetry_event_id).toContain("005")
  })

  it("hands out a copy, so a reader cannot edit what it holds", async () => {
    const transport = createLocalOnlyTransport()
    await transport.submit(payload(1))

    const first = transport.entries()
    await transport.submit(payload(2))

    expect(first).toHaveLength(1)
    expect(transport.entries()).toHaveLength(2)
  })

  it("empties on request", async () => {
    const transport = createLocalOnlyTransport()
    await transport.submit(payload(1))

    transport.clear()

    expect(transport.entries()).toEqual([])
  })
})
