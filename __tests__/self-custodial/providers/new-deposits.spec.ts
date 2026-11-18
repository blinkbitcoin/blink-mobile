import { it } from "@jest/globals"
import { type DepositInfo } from "@breeztech/breez-sdk-spark-react-native"

import {
  emitNewDeposits,
  onNewDeposits,
} from "@app/self-custodial/providers/new-deposits"

const deposits = [{ txid: "t1", vout: 0 }] as unknown as DepositInfo[]

describe("new deposits", () => {
  it("still reaches the other listeners when one throws", () => {
    const unsubscribeThrowing = onNewDeposits(() => {
      throw new Error("observer broke")
    })
    const after = jest.fn()
    const unsubscribeAfter = onNewDeposits(after)

    expect(() => emitNewDeposits(deposits)).not.toThrow()
    expect(after).toHaveBeenCalledWith(deposits)

    unsubscribeThrowing()
    unsubscribeAfter()
  })
})
