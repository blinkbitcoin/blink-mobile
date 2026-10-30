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

/**
 * The payment an event carries, when it carries one. Typed loosely on the way in
 * (the SDK's event union arrives as a tag plus unknown inner) and returned as the full
 * payment so observers can read direction, method and status, not only the id.
 */
export const extractObservedPayment = (event: PaymentEvent): Payment | null => {
  const payment = extractPayment(event)
  if (!payment) return null
  if (
    typeof payment.paymentType !== "number" ||
    typeof payment.method !== "number" ||
    typeof payment.status !== "number"
  ) {
    return null
  }
  return payment
}

/**
 * Identity of a payment event for scheduling deduplication. The tag is part
 * of the key because the same payment id arrives first as PaymentPending and
 * later as PaymentSucceeded - settlement changes leaf state, so it must be
 * distinguishable from the pending event it follows. Duplicate deliveries of
 * the same event stay deduplicated.
 */
export const paymentEventKey = (event: PaymentEvent): string | null => {
  const id = extractPaymentId(event)
  return id ? `${event.tag}:${id}` : null
}

/**
 * Inverse of paymentEventKey for consumers that need the payment id alone.
 * Splits on the FIRST ":" - tags never contain ":", payment ids may.
 */
export const paymentIdFromEventKey = (eventKey: string | null): string | null =>
  eventKey ? eventKey.slice(eventKey.indexOf(":") + 1) : null
