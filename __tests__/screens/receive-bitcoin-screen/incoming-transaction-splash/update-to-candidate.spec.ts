import { TxNotificationType } from "@app/graphql/generated"
import { candidateFromUpdate } from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/update-to-candidate"

const transaction = {
  id: "tx-1",
  initiationVia: { __typename: "InitiationViaLn", paymentHash: "hash" },
} as never

describe("candidateFromUpdate", () => {
  it("offers a paid lightning update", () => {
    expect(
      candidateFromUpdate({
        __typename: "LnUpdate",
        status: "PAID",
        transaction,
      }),
    ).toEqual({
      transaction,
      paymentType: "lightning",
      paymentHash: "hash",
    })
  })

  it("ignores an unpaid lightning update", () => {
    expect(
      candidateFromUpdate({
        __typename: "LnUpdate",
        status: "PENDING",
        transaction,
      }),
    ).toBeNull()
  })

  it("offers an intraledger receipt and ignores a payment", () => {
    expect(
      candidateFromUpdate({
        __typename: "IntraLedgerUpdate",
        txNotificationType: TxNotificationType.IntraLedgerReceipt,
        transaction,
      })?.paymentType,
    ).toBe("intraledger")
    expect(
      candidateFromUpdate({
        __typename: "IntraLedgerUpdate",
        txNotificationType: TxNotificationType.IntraLedgerPayment,
        transaction,
      }),
    ).toBeNull()
  })

  it("offers a pending on-chain receipt and ignores the confirmed one", () => {
    expect(
      candidateFromUpdate({
        __typename: "OnChainUpdate",
        txNotificationType: TxNotificationType.OnchainReceiptPending,
        transaction,
      })?.paymentType,
    ).toBe("onchain")
    expect(
      candidateFromUpdate({
        __typename: "OnChainUpdate",
        txNotificationType: TxNotificationType.OnchainReceipt,
        transaction,
      }),
    ).toBeNull()
  })
})
