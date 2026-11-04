import { TxNotificationType } from "@app/graphql/generated"
import { candidateFromUpdate } from "@app/screens/receive-bitcoin-screen/celebration/update-to-candidate"

const transaction = {
  id: "tx-1",
  initiationVia: { __typename: "InitiationViaLn", paymentHash: "hash" },
} as never

describe("candidateFromUpdate", () => {
  it("celebrates a paid lightning update", () => {
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

  it("celebrates an intraledger receipt and ignores a payment", () => {
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

  it("celebrates a confirmed on-chain receipt and ignores a pending one", () => {
    expect(
      candidateFromUpdate({
        __typename: "OnChainUpdate",
        txNotificationType: TxNotificationType.OnchainReceipt,
        transaction,
      })?.paymentType,
    ).toBe("onchain")
    expect(
      candidateFromUpdate({
        __typename: "OnChainUpdate",
        txNotificationType: TxNotificationType.OnchainReceiptPending,
        transaction,
      }),
    ).toBeNull()
  })
})
