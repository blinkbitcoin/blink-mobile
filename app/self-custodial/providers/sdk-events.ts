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
 * The settled payment an event carries, when it carries one. Typed loosely on the way in
 * (the SDK's event union arrives as a tag plus unknown inner) and returned as the full
 * payment so observers can read direction and method, not only the id.
 */
export const extractObservedPayment = (event: PaymentEvent): Payment | null => {
  const payment = extractPayment(event)
  if (!payment) return null
  if (typeof payment.paymentType !== "number" || typeof payment.method !== "number") {
    return null
  }
  return payment
}
