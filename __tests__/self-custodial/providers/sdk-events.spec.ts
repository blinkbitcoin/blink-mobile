import { SdkEvent_Tags as SdkEventTags } from "@breeztech/breez-sdk-spark-react-native"

import {
  extractPaymentId,
  REFRESH_EVENTS,
  PAYMENT_RECEIVED_EVENTS,
} from "@app/self-custodial/providers/sdk-events"

describe("sdk-events", () => {
  describe("REFRESH_EVENTS", () => {
    it("includes Synced for general SDK sync ticks", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.Synced)).toBe(true)
    })

    it("includes PaymentSucceeded so a successful send refreshes wallet state", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.PaymentSucceeded)).toBe(true)
    })

    it("includes PaymentPending so an in-flight payment refreshes wallet state", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.PaymentPending)).toBe(true)
    })

    it("includes ClaimedDeposits so a claim updates the wallets list", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.ClaimedDeposits)).toBe(true)
    })

    it("includes UnclaimedDeposits so the deposit banner updates", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.UnclaimedDeposits)).toBe(true)
    })

    it("includes NewDeposits so newly seen deposits trigger a refresh", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.NewDeposits)).toBe(true)
    })

    it("does NOT include PaymentFailed (failed sends should not trigger a refresh)", () => {
      expect(REFRESH_EVENTS.has(SdkEventTags.PaymentFailed)).toBe(false)
    })

    it("contains exactly the documented refresh tags (no silent additions)", () => {
      expect(REFRESH_EVENTS.size).toBe(6)
    })
  })

  describe("PAYMENT_RECEIVED_EVENTS", () => {
    it("includes PaymentSucceeded", () => {
      expect(PAYMENT_RECEIVED_EVENTS.has(SdkEventTags.PaymentSucceeded)).toBe(true)
    })

    it("includes PaymentPending (treated as received for UI feedback)", () => {
      expect(PAYMENT_RECEIVED_EVENTS.has(SdkEventTags.PaymentPending)).toBe(true)
    })

    it("does NOT include PaymentFailed", () => {
      expect(PAYMENT_RECEIVED_EVENTS.has(SdkEventTags.PaymentFailed)).toBe(false)
    })

    it("contains exactly the two documented received-payment tags", () => {
      expect(PAYMENT_RECEIVED_EVENTS.size).toBe(2)
    })
  })

  describe("extractPaymentId", () => {
    it("extracts id from payment event", () => {
      const event = {
        tag: "PaymentSucceeded",
        inner: { payment: { id: "pay-123" } },
      }

      expect(extractPaymentId(event)).toBe("pay-123")
    })

    it("returns null when no inner", () => {
      expect(extractPaymentId({ tag: "Synced" })).toBeNull()
    })

    it("returns null when inner has no payment", () => {
      expect(extractPaymentId({ tag: "Synced", inner: { other: "data" } })).toBeNull()
    })

    it("returns null when inner is not an object", () => {
      expect(extractPaymentId({ tag: "Synced", inner: "string" })).toBeNull()
    })
  })
})
