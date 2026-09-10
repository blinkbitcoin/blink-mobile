/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  ConversionStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type ConversionDetails,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"
import RNFS from "react-native-fs"
import Crypto from "react-native-quick-crypto"

import { logPaymentSettled, logReferralCompleted } from "@app/self-custodial/measurement"
import { RailType, TelemetryDirection } from "@app/telemetry/contract"
import {
  getDiagnosticCounters,
  resetDiagnosticsForTesting,
} from "@app/telemetry/diagnostics"
import { setActiveOutbox } from "@app/telemetry/index"
import {
  initializeTelemetryGate,
  onTelemetrySuppressed,
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"
import { drainOutbox } from "@app/telemetry/outbox/drain"
import {
  createOutboxStore,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"
import {
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
  type TransportResult,
} from "@app/telemetry/transport"

const setCollectionEnabled = analytics().setAnalyticsCollectionEnabled as jest.Mock
const setUserId = analytics().setUserId as jest.Mock
const randomUUID = Crypto.randomUUID as jest.Mock

const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

const DIR_A = "/mock/documents/blink-telemetry-outbox-regtest/account-a"
const DIR_B = "/mock/documents/blink-telemetry-outbox-regtest/account-b"

let idSeed = 0
const nextUuid = () =>
  `3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7${String((idSeed += 1)).padStart(2, "0")}`

const payment = (overrides: Partial<Payment> = {}): Payment =>
  ({
    id: `sdk-payment-${idSeed}`,
    paymentType: SdkPaymentType.Receive,
    status: PaymentStatus.Completed,
    amount: 21000n,
    fees: 1n,
    timestamp: 1757203200n,
    method: PaymentMethod.Lightning,
    details: undefined,
    conversionDetails: undefined,
    ...overrides,
  }) as Payment

const queued = (store: ReturnType<typeof createOutboxStore>) => store.pending()

const side = (asset: "btc" | "usdb") => ({
  chain: 0,
  /** `identifier` is `None` for BTC/sats and a token identifier otherwise — the SDK's own
   *  marker for which end of a swap is bitcoin. */
  asset: {
    ticker: asset.toUpperCase(),
    identifier: asset === "btc" ? undefined : "usdb-id",
    decimals: asset === "btc" ? 0 : 6,
  },
  amount: 1n,
  fee: 0n,
})

const conversion = ({
  status = ConversionStatus.Completed,
  from = "btc" as "btc" | "usdb",
  to = "usdb" as "btc" | "usdb",
  legs,
}: {
  status?: ConversionStatus
  from?: "btc" | "usdb"
  to?: "btc" | "usdb"
  legs?: unknown[]
} = {}): ConversionDetails =>
  ({
    status,
    conversions: legs ?? [{ provider: 0, status, from: side(from), to: side(to) }],
  }) as unknown as ConversionDetails

/** The gate owns the discard ordering; the provider is what registers it in the app. */
const registerDiscard = (store: ReturnType<typeof createOutboxStore>) =>
  onTelemetrySuppressed(() => store.discardAll())

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe("the telemetry privacy boundary", () => {
  let store: ReturnType<typeof createOutboxStore>

  beforeEach(() => {
    jest.clearAllMocks()
    // clearAllMocks only clears call records — a mockReturnValueOnce left unconsumed by an
    // earlier test would otherwise be handed to this one.
    randomUUID.mockReset()
    randomUUID.mockImplementation(nextUuid)

    idSeed = 0
    mockFs.__resetMockFileSystem()
    resetTelemetryModeForTesting()
    resetTelemetryTransportForTesting()
    resetOutboxCountersForTesting()
    resetDiagnosticsForTesting()

    store = createOutboxStore(DIR_A)
    setActiveOutbox(store)
  })

  afterEach(() => {
    setActiveOutbox(null)
  })

  /** Every negative assertion is checked against this, so "nothing was captured" can never
   *  pass because the call site was silently broken. */
  const enhancedCaptures = async (): Promise<number> => {
    await resolveTelemetryMode(TelemetryMode.Enhanced)
    logPaymentSettled(payment({ id: `control-${(idSeed += 1)}` }))
    return (await queued(store)).length
  }

  describe("FR-9 suppression matrix", () => {
    it("cold start: captures nothing before a mode is resolved", async () => {
      await initializeTelemetryGate()

      logPaymentSettled(payment())
      logPaymentSettled(payment({ id: "swap", conversionDetails: conversion() }))
      logReferralCompleted({ sdkPaymentId: "p" })

      expect(await queued(store)).toEqual([])
      expect(setCollectionEnabled).toHaveBeenCalledWith(false)
      // Anchor: the very same calls do land once the mode resolves.
      expect(await enhancedCaptures()).toBe(1)
    })

    it("restore from backup: a mode-less account stays silent", async () => {
      // An interrupted restore leaves an account permanently without a stored mode, and
      // nothing asks again. The settings row reads that as Enhanced so it has something to
      // display; the gate must not.
      await resolveTelemetryMode(TelemetryMode.Unresolved)

      logPaymentSettled(payment())

      expect(await queued(store)).toEqual([])
      expect(await enhancedCaptures()).toBe(1)
    })

    it("failed LNURL mode recovery: still silent, never enabled", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await resolveTelemetryMode(TelemetryMode.Unresolved)

      logPaymentSettled(payment())

      expect(await queued(store)).toEqual([])
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
    })

    it("incognito: captures nothing, and discards what was already queued", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      const unsubscribe = registerDiscard(store)
      logPaymentSettled(payment({ id: "sdk-before-switch" }))
      expect(await queued(store)).toHaveLength(1)

      await resolveTelemetryMode(TelemetryMode.Anon)

      expect(await queued(store)).toEqual([])
      logPaymentSettled(payment({ id: "sdk-after-switch" }))
      expect(await queued(store)).toEqual([])
      unsubscribe()
    })

    it("race: an event arriving before the mode resolves is not held for later", async () => {
      await initializeTelemetryGate()
      logPaymentSettled(payment({ id: "sdk-early" }))

      await resolveTelemetryMode(TelemetryMode.Enhanced)

      // Nothing was buffered in memory waiting for permission — the gate runs before a
      // payload is even built.
      expect(await queued(store)).toEqual([])
    })

    it("account switch: an event is filed against the account that was active", async () => {
      const storeB = createOutboxStore(DIR_B)
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      logPaymentSettled(payment({ id: "sdk-on-a" }))
      setActiveOutbox(storeB)
      logPaymentSettled(payment({ id: "sdk-on-b" }))

      expect(await queued(store)).toHaveLength(1)
      expect(await queued(storeB)).toHaveLength(1)
    })

    it("custodial → self-custodial: no user-scoped identity survives (AD-16)", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      setUserId.mockClear()

      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(setUserId).toHaveBeenCalledWith(null)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it("offline then reconnect: retried without duplicating", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      logPaymentSettled(payment({ id: "sdk-offline" }))
      await settle()

      const submit = jest
        .fn<Promise<TransportResult>, unknown[]>()
        .mockResolvedValueOnce({ outcome: "unavailable" })
        .mockResolvedValue({ outcome: "acknowledged" })
      registerTelemetryTransport({
        name: "flaky",
        attachesPerEventIdentity: false,
        submit,
      })

      await drainOutbox(store, { delay: () => Promise.resolve() })
      expect(await queued(store)).toHaveLength(1)

      await drainOutbox(store, { delay: () => Promise.resolve() })

      expect(await queued(store)).toEqual([])
      const ids = submit.mock.calls.map(
        ([, payload]) => (payload as Record<string, string>).telemetry_event_id,
      )
      expect(ids).toHaveLength(2)
      expect(new Set(ids).size).toBe(1)
    })
  })

  describe("FR-70 — an Enhanced device leaves the platform's own counts", () => {
    it("disables platform collection while permitting contract events", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      logPaymentSettled(payment())

      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
      expect(await queued(store)).toHaveLength(1)
    })
  })

  describe("classification (AD-2, AD-7)", () => {
    beforeEach(async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
    })

    it.each([
      { method: PaymentMethod.Lightning, rail: RailType.Lightning },
      { method: PaymentMethod.Spark, rail: RailType.Spark },
      { method: PaymentMethod.Token, rail: RailType.Spark },
      { method: PaymentMethod.Deposit, rail: RailType.Onchain },
      { method: PaymentMethod.Withdraw, rail: RailType.Onchain },
      { method: PaymentMethod.Unknown, rail: RailType.Unknown },
    ])("maps method $method to rail $rail", async ({ method, rail }) => {
      logPaymentSettled(payment({ method, id: `sdk-${String(method)}` }))

      const [record] = await queued(store)
      expect(record.payload.rail_type).toBe(rail)
    })

    it("counts an unclassifiable rail rather than dropping or guessing it (AD-7)", async () => {
      // The transaction mapper masks Unknown as Lightning. Fine for a row, wrong for a
      // count: it would inflate a real bucket. Dropping would leave the split short of the
      // settled total. Naming it keeps both numbers honest.
      logPaymentSettled(payment({ method: PaymentMethod.Unknown }))

      const [record] = await queued(store)
      expect(record.payload.rail_type).toBe("unknown")
    })

    it.each([
      { paymentType: SdkPaymentType.Send, direction: TelemetryDirection.Send },
      { paymentType: SdkPaymentType.Receive, direction: TelemetryDirection.Receive },
    ])(
      "reads direction $direction off the settlement record",
      async ({ paymentType, direction }) => {
        logPaymentSettled(payment({ paymentType, id: `sdk-${String(paymentType)}` }))

        const [record] = await queued(store)
        expect(record.payload.direction).toBe(direction)
      },
    )

    it("counts a conversion leg as a swap rather than as a payment", async () => {
      logPaymentSettled(payment({ id: "sdk-swap", conversionDetails: conversion() }))

      const [record] = await queued(store)
      expect(record.event).toBe("conversion_settled")
      expect(record.payload.conversion_direction).toBe("btc_to_usd")
      // The one record is the swap, so the payment leg was not counted alongside it.
      expect(await queued(store)).toHaveLength(1)
    })

    it.each([
      { from: "btc" as const, to: "usdb" as const, expected: "btc_to_usd" },
      { from: "usdb" as const, to: "btc" as const, expected: "usd_to_btc" },
    ])(
      "reads $expected off the settled record's own ends",
      async ({ from, to, expected }) => {
        logPaymentSettled(
          payment({ id: `sdk-${expected}`, conversionDetails: conversion({ from, to }) }),
        )

        const [record] = await queued(store)
        expect(record.payload.conversion_direction).toBe(expected)
      },
    )

    it("takes the direction from the ends of a multi-leg route, not an intermediate", async () => {
      // The SDK models a send as [AMM, cross-chain], so a middle asset is routing rather
      // than intent — reading leg zero's destination would classify the hop, not the swap.
      const legs = [
        {
          provider: 0,
          status: ConversionStatus.Completed,
          from: side("usdb"),
          to: side("usdb"),
        },
        {
          provider: 0,
          status: ConversionStatus.Completed,
          from: side("usdb"),
          to: side("btc"),
        },
      ]
      logPaymentSettled(
        payment({ id: "sdk-multi", conversionDetails: conversion({ legs }) }),
      )

      const [record] = await queued(store)
      expect(record.payload.conversion_direction).toBe("usd_to_btc")
    })

    it("counts nothing for a swap whose send leg landed but whose conversion has not", async () => {
      // The overcount this event exists to avoid: a send resolving is not a settled swap,
      // and one counted here would stay counted when the conversion later fails.
      logPaymentSettled(
        payment({
          id: "sdk-pending-swap",
          conversionDetails: conversion({ status: ConversionStatus.Pending }),
        }),
      )
      expect(await queued(store)).toEqual([])

      // Anchor: the same record with a completed conversion does land.
      logPaymentSettled(payment({ id: "sdk-done-swap", conversionDetails: conversion() }))
      expect(await queued(store)).toHaveLength(1)
    })

    it("counts nothing for a swap it cannot place, rather than guessing a side", async () => {
      logPaymentSettled(
        payment({
          id: "sdk-same-sided",
          conversionDetails: conversion({ from: "usdb", to: "usdb" }),
        }),
      )
      expect(await queued(store)).toEqual([])

      logPaymentSettled(
        payment({ id: "sdk-legless", conversionDetails: conversion({ legs: [] }) }),
      )
      expect(await queued(store)).toEqual([])

      expect(await enhancedCaptures()).toBe(1)
    })

    it("ignores a payment that has not settled", async () => {
      logPaymentSettled(payment({ status: PaymentStatus.Pending }))
      expect(await queued(store)).toEqual([])

      expect(await enhancedCaptures()).toBe(1)
    })
  })

  describe("NFR-R2 — telemetry is never worth a payment", () => {
    beforeEach(async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
    })

    it("swallows an unreadable settlement record", () => {
      expect(() => logPaymentSettled(undefined as unknown as Payment)).not.toThrow()
    })

    it("swallows a store that cannot be written", async () => {
      setActiveOutbox({
        ...store,
        enqueue: () => Promise.reject(new Error("disk full")),
      })

      expect(() => logPaymentSettled(payment())).not.toThrow()
      await settle()
    })
  })

  describe("AD-13 — a device required to emit zero emits nothing, diagnostics included", () => {
    it("holds a suppressed count locally instead of reporting it", async () => {
      await resolveTelemetryMode(TelemetryMode.Anon)

      logPaymentSettled(payment())

      expect(getDiagnosticCounters().suppressedEvents).toBe(1)
      expect(await queued(store)).toEqual([])
    })
  })
})
