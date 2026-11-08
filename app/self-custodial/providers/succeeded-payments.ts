import { type Payment } from "@breeztech/breez-sdk-spark-react-native"

export type SucceededPaymentInfo = {
  /** The SDK reported this payment pending earlier in this session: its claim was seen
   *  starting live, so it is a new payment whatever its `timestamp` says. That timestamp
   *  is when the payment was created (for a receive, when its invoice was), not when it
   *  settled. A restore's replay of past payments arrives completed, never pending. */
  claimSeenLive: boolean
}

type SucceededPaymentListener = (payment: Payment, info: SucceededPaymentInfo) => void

const listeners = new Set<SucceededPaymentListener>()

/** Ids the SDK has reported pending and not yet succeeded. */
const pendingIds = new Set<string>()

/**
 * Every payment the SDK reports as succeeded, handed over the moment its event lands,
 * ahead of the wallet refresh that event triggers (seconds on a busy wallet). For
 * observers that react to the payment itself, such as the incoming transaction splash.
 */
export const onSucceededPayment = (listener: SucceededPaymentListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const notePendingPayment = (payment: Payment): void => {
  pendingIds.add(payment.id)
}

export const emitSucceededPayment = (payment: Payment): void => {
  const info = { claimSeenLive: pendingIds.delete(payment.id) }
  listeners.forEach((listener) => listener(payment, info))
}
