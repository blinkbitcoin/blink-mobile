import { type Payment } from "@breeztech/breez-sdk-spark-react-native"

type SucceededPaymentListener = (payment: Payment) => void

const listeners = new Set<SucceededPaymentListener>()

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

export const emitSucceededPayment = (payment: Payment): void => {
  listeners.forEach((listener) => listener(payment))
}
