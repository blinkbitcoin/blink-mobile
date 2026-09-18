import {
  SdkEvent_Tags as SdkEventTags,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

export const REFRESH_EVENTS = new Set([
  SdkEventTags.Synced,
  SdkEventTags.PaymentSucceeded,
  SdkEventTags.PaymentPending,
  SdkEventTags.ClaimedDeposits,
  SdkEventTags.UnclaimedDeposits,
  SdkEventTags.NewDeposits,
])

export const PAYMENT_RECEIVED_EVENTS = new Set([
  SdkEventTags.PaymentSucceeded,
  SdkEventTags.PaymentPending,
])

/**
 * Settlement proper — narrower than PAYMENT_RECEIVED_EVENTS, which also carries Pending so
 * the UI can react before a payment is final. Telemetry counts settled payments, and a
 * pending payment may still fail.
 */
export const PAYMENT_SETTLED_EVENTS = new Set([SdkEventTags.PaymentSucceeded])

type PaymentEvent = {
  tag: string
  inner?: unknown
}

const extractPayment = (event: PaymentEvent): Payment | null => {
  if (!("inner" in event)) return null
  const inner = event.inner
  if (!inner || typeof inner !== "object" || !("payment" in inner)) return null
  return (inner as { payment: Payment }).payment
}

export const extractPaymentId = (event: PaymentEvent): string | null =>
  extractPayment(event)?.id ?? null

/** The whole settlement record, which telemetry needs to classify direction and rail. */
export const extractSettledPayment = (event: PaymentEvent): Payment | null =>
  PAYMENT_SETTLED_EVENTS.has(event.tag as SdkEventTags) ? extractPayment(event) : null
