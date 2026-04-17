import {
  extractPaymentId,
  REFRESH_EVENTS,
  PAYMENT_RECEIVED_EVENTS,
} from "@app/self-custodial/providers/sdk-events"

describe("sdk-events", () => {
  describe("REFRESH_EVENTS", () => {
    it("includes expected event tags", () => {
      expect(REFRESH_EVENTS.size).toBeGreaterThanOrEqual(5)
    })

    it("does not include PaymentFailed", () => {
      const tags = [...REFRESH_EVENTS]
      expect(tags).not.toContain("PaymentFailed")
    })
  })

  describe("PAYMENT_RECEIVED_EVENTS", () => {
    it("has at least 2 events", () => {
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
