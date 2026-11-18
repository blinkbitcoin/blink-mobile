import { it } from "@jest/globals"
import { type DepositInfo } from "@breeztech/breez-sdk-spark-react-native"

import {
  depositsToAnnounce,
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

describe("depositsToAnnounce", () => {
  const mature = { txid: "old", vout: 0, isMature: true } as DepositInfo
  const immature = { txid: "live", vout: 0, isMature: false } as DepositInfo

  it("keeps only immature deposits on storage created by this connect", () => {
    expect(depositsToAnnounce([mature, immature], { freshStorage: true })).toEqual([
      immature,
    ])
  })

  it("keeps every deposit on storage that already existed", () => {
    expect(depositsToAnnounce([mature, immature], { freshStorage: false })).toEqual([
      mature,
      immature,
    ])
  })
})
