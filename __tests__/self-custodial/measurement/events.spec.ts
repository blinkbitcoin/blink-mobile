/* eslint-disable camelcase */
// See policy.spec.ts — the mocha types in tsconfig shadow Jest's `it`.
import { it } from "@jest/globals"

import {
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"
import Crypto from "react-native-quick-crypto"

import { logConversionSettled, logPaymentSettled } from "@app/self-custodial/measurement"
import {
  resetDeliveryAdapterForTesting,
  setDeliveryAdapter,
} from "@app/self-custodial/measurement/delivery"
import { resetTelemetryEventIdsForTesting } from "@app/self-custodial/measurement/event-id"
import {
  resetTelemetryGateForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/self-custodial/measurement/gate"
import { ConvertDirection } from "@app/types/payment"

const logEvent = analytics().logEvent as jest.Mock
const randomUUID = Crypto.randomUUID as jest.Mock

const UUID_A = "11111111-1111-4111-8111-111111111111"
const UUID_B = "22222222-2222-4222-8222-222222222222"

const payment = (overrides: Partial<Payment> = {}): Payment =>
  ({
    id: "sdk-payment-1",
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

const lastPayload = () => logEvent.mock.calls[logEvent.mock.calls.length - 1][1]

type RailCase = { method: number; rail: string }

const RAILS: RailCase[] = [
  { method: PaymentMethod.Lightning, rail: "lightning" },
  { method: PaymentMethod.Spark, rail: "spark" },
  { method: PaymentMethod.Token, rail: "spark" },
  { method: PaymentMethod.Deposit, rail: "onchain" },
  { method: PaymentMethod.Withdraw, rail: "onchain" },
]

describe("enhanced-mode measurement events", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetTelemetryGateForTesting()
    resetTelemetryEventIdsForTesting()
    // clearAllMocks only clears call records — a mockReturnValueOnce left unconsumed by
    // an earlier test would otherwise be handed to this one.
    randomUUID.mockReset()
    randomUUID.mockReturnValue(UUID_A)
    resolveTelemetryMode(TelemetryMode.Enhanced)
  })

  describe("FR-10 and FR-11 — settled payments, both directions, every observed receive", () => {
    it("emits payment_settled for a settled send", () => {
      logPaymentSettled(payment({ paymentType: SdkPaymentType.Send }))

      expect(logEvent).toHaveBeenCalledWith("payment_settled", {
        event_version: 1,
        wallet_provider: "spark",
        direction: "send",
        rail_type: "lightning",
        telemetry_event_id: UUID_A,
      })
    })

    it("emits payment_settled for a settled receive", () => {
      logPaymentSettled(payment({ paymentType: SdkPaymentType.Receive }))

      expect(lastPayload()).toMatchObject({ direction: "receive" })
    })

    it("counts a direct Spark receive, not only Lightning Address traffic", () => {
      logPaymentSettled(
        payment({ paymentType: SdkPaymentType.Receive, method: PaymentMethod.Spark }),
      )

      expect(lastPayload()).toMatchObject({ direction: "receive", rail_type: "spark" })
    })
  })

  describe("FR-16 and CD-5 — three coarse rails and no more", () => {
    it.each(RAILS)("classifies method $method as $rail", ({ method, rail }) => {
      logPaymentSettled(payment({ method }))

      expect(lastPayload()).toMatchObject({ rail_type: rail })
    })

    it("drops a record whose rail the SDK reports as unknown rather than guessing", () => {
      logPaymentSettled(payment({ method: PaymentMethod.Unknown }))

      expect(logEvent).not.toHaveBeenCalled()
      // Anchor: a classifiable record on the same path does emit.
      logPaymentSettled(payment({ method: PaymentMethod.Lightning }))
      expect(logEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe("no double counting between a swap and its settlement legs", () => {
    it("skips payment_settled for a payment carrying conversion details", () => {
      logPaymentSettled(
        payment({
          method: PaymentMethod.Token,
          conversionDetails: { some: "detail" } as never,
        }),
      )

      expect(logEvent).not.toHaveBeenCalled()
      // Anchor: the same token payment without a conversion is counted normally.
      logPaymentSettled(payment({ method: PaymentMethod.Token }))
      expect(logEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe("FR-12 and FR-15 — swap direction without volume", () => {
    it("maps btc_to_usd", () => {
      logConversionSettled({
        direction: ConvertDirection.BtcToUsd,
        sdkPaymentId: "conv-1",
      })

      expect(logEvent).toHaveBeenCalledWith("conversion_settled", {
        event_version: 1,
        wallet_provider: "spark",
        conversion_direction: "btc_to_usd",
        telemetry_event_id: UUID_A,
      })
    })

    it("maps usd_to_btc", () => {
      logConversionSettled({
        direction: ConvertDirection.UsdToBtc,
        sdkPaymentId: "conv-2",
      })

      expect(lastPayload()).toMatchObject({ conversion_direction: "usd_to_btc" })
    })

    it("carries no amount, fee or destination in any event", () => {
      logPaymentSettled(payment())
      logConversionSettled({ direction: ConvertDirection.BtcToUsd, sdkPaymentId: "c" })

      const forbidden = [
        "amount",
        "amount_sats",
        "fee",
        "fees",
        "destination",
        "payment_hash",
        "payment_id",
        "pubkey",
        "lightning_address",
        "account_id",
      ]
      for (const [, payload] of logEvent.mock.calls) {
        for (const key of forbidden) expect(payload).not.toHaveProperty(key)
      }
      expect(logEvent).toHaveBeenCalledTimes(2)
    })

    it("never transmits the SDK payment id it was keyed on", () => {
      logConversionSettled({
        direction: ConvertDirection.BtcToUsd,
        sdkPaymentId: "sdk-secret-id",
      })

      expect(JSON.stringify(logEvent.mock.calls)).not.toContain("sdk-secret-id")
    })
  })

  describe("a telemetry fault never reaches the flow that emitted it", () => {
    afterEach(() => {
      resetDeliveryAdapterForTesting()
    })

    it("swallows a throwing delivery adapter", () => {
      setDeliveryAdapter(() => {
        throw new Error("transport exploded")
      })

      // The settlement listener that calls this also drives the wallet refresh: a throw
      // here would cost the user their balance update to save a metric.
      expect(() => logPaymentSettled(payment())).not.toThrow()
      expect(() =>
        logConversionSettled({ direction: ConvertDirection.BtcToUsd, sdkPaymentId: "c" }),
      ).not.toThrow()
    })

    it("swallows an unreadable settlement record", () => {
      expect(() => logPaymentSettled(undefined as unknown as Payment)).not.toThrow()
    })
  })

  describe("FR-22 and FR-23 — one random id per payment, stable across callbacks", () => {
    it("reuses the same id when the SDK re-delivers a settlement", () => {
      randomUUID.mockReturnValueOnce(UUID_A).mockReturnValueOnce(UUID_B)

      logPaymentSettled(payment({ id: "same-payment" }))
      logPaymentSettled(payment({ id: "same-payment" }))

      const [first, second] = logEvent.mock.calls
      expect(first[1].telemetry_event_id).toBe(UUID_A)
      // Regenerating per callback is the defect the addendum names: it would produce
      // UUID_B here and silently double-count the payment downstream.
      expect(second[1].telemetry_event_id).toBe(UUID_A)
    })

    it("mints a distinct id for a different payment", () => {
      randomUUID.mockReturnValueOnce(UUID_A).mockReturnValueOnce(UUID_B)

      logPaymentSettled(payment({ id: "payment-one" }))
      logPaymentSettled(payment({ id: "payment-two" }))

      const [first, second] = logEvent.mock.calls
      expect(first[1].telemetry_event_id).toBe(UUID_A)
      expect(second[1].telemetry_event_id).toBe(UUID_B)
    })

    it("does not retain an id when the SDK gave nothing to key on", () => {
      randomUUID.mockReturnValueOnce(UUID_A).mockReturnValueOnce(UUID_B)

      logConversionSettled({ direction: ConvertDirection.BtcToUsd, sdkPaymentId: null })
      logConversionSettled({ direction: ConvertDirection.BtcToUsd, sdkPaymentId: null })

      const [first, second] = logEvent.mock.calls
      expect(first[1].telemetry_event_id).toBe(UUID_A)
      expect(second[1].telemetry_event_id).toBe(UUID_B)
    })
  })
})
