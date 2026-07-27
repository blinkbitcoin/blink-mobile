import { SdkEvent_Tags as SdkEventTags } from "@breeztech/breez-sdk-spark-react-native"

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

const extractPayment = (event: PaymentEvent): { id: string } | null => {
  if (!("inner" in event)) return null
  const inner = event.inner
  if (!inner || typeof inner !== "object" || !("payment" in inner)) return null
  return (inner as { payment: { id: string } }).payment
}

export const extractPaymentId = (event: PaymentEvent): string | null =>
  extractPayment(event)?.id ?? null

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
