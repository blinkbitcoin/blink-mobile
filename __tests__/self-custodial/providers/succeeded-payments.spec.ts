import { it } from "@jest/globals"
import { type Payment } from "@breeztech/breez-sdk-spark-react-native"

import {
  clearPendingPayments,
  emitSucceededPayment,
  noteFailedPayment,
  notePendingPayment,
  onSucceededPayment,
} from "@app/self-custodial/providers/succeeded-payments"

const payment = (id: string) => ({ id }) as Payment

describe("succeeded payments", () => {
  const listener = jest.fn()
  let unsubscribe: () => void

  beforeEach(() => {
    listener.mockClear()
    clearPendingPayments()
    unsubscribe = onSucceededPayment(listener)
  })

  afterEach(() => unsubscribe())

  const claimSeenLive = () =>
    listener.mock.calls.map(
      ([, info]) => (info as { claimSeenLive: boolean }).claimSeenLive,
    )

  it("marks a payment reported pending first as live, once", () => {
    notePendingPayment(payment("a"))
    emitSucceededPayment(payment("a"))
    emitSucceededPayment(payment("a"))

    expect(claimSeenLive()).toEqual([true, false])
  })

  it("forgets a pending payment that fails", () => {
    notePendingPayment(payment("a"))
    noteFailedPayment(payment("a"))
    emitSucceededPayment(payment("a"))

    expect(claimSeenLive()).toEqual([false])
  })

  it("forgets every pending payment when the wallet disconnects", () => {
    notePendingPayment(payment("a"))
    notePendingPayment(payment("b"))
    clearPendingPayments()
    emitSucceededPayment(payment("a"))
    emitSucceededPayment(payment("b"))

    expect(claimSeenLive()).toEqual([false, false])
  })
})
