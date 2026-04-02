import { TxDirection, TxStatus, WalletCurrency } from "@app/graphql/generated"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"

import {
  mapCustodialTransaction,
  mapCustodialTransactions,
} from "@app/custodial/mappers/transaction-mapper"

const baseTx = {
  __typename: "Transaction" as const,
  id: "tx-1",
  status: TxStatus.Success,
  direction: TxDirection.Send,
  memo: null,
  createdAt: 1700000000,
  settlementAmount: -500,
  settlementFee: 10,
  settlementDisplayFee: "0.10",
  settlementCurrency: WalletCurrency.Btc,
  settlementDisplayAmount: "0.50",
  settlementDisplayCurrency: "USD",
  settlementPrice: {
    __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit" as const,
    base: 100,
    offset: 0,
    currencyUnit: "USD",
    formattedAmount: "0.50",
  },
  initiationVia: {
    __typename: "InitiationViaLn" as const,
    paymentHash: "hash123",
    paymentRequest: "lnbc1...",
  },
  settlementVia: {
    __typename: "SettlementViaLn" as const,
    preImage: "preimage123",
  },
}

describe("mapCustodialTransaction", () => {
  it("maps a Lightning send transaction", () => {
    const result = mapCustodialTransaction(baseTx, WalletCurrency.Btc)

    expect(result.id).toBe("tx-1")
    expect(result.direction).toBe(TransactionDirection.Send)
    expect(result.status).toBe(TransactionStatus.Completed)
    expect(result.paymentType).toBe(PaymentType.Lightning)
    expect(result.timestamp).toBe(1700000000)
    expect(result.amount.amount).toBe(500)
    expect(result.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.fee?.amount).toBe(10)
    expect(result.sourceAccountType).toBe(AccountType.Custodial)
  })

  it("maps direction Receive correctly", () => {
    const tx = { ...baseTx, direction: TxDirection.Receive }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.direction).toBe(TransactionDirection.Receive)
  })

  it("maps status Pending correctly", () => {
    const tx = { ...baseTx, status: TxStatus.Pending }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.status).toBe(TransactionStatus.Pending)
  })

  it("maps status Failure correctly", () => {
    const tx = { ...baseTx, status: TxStatus.Failure }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.status).toBe(TransactionStatus.Failed)
  })

  it("maps OnChain initiation to onchain payment type", () => {
    const tx = {
      ...baseTx,
      initiationVia: {
        __typename: "InitiationViaOnChain" as const,
        address: "bc1q...",
      },
      settlementVia: {
        __typename: "SettlementViaOnChain" as const,
        transactionHash: "txhash",
        arrivalInMempoolEstimatedAt: null,
      },
    }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.paymentType).toBe(PaymentType.Onchain)
  })

  it("maps IntraLedger with counterPartyWalletId as conversion", () => {
    const tx = {
      ...baseTx,
      initiationVia: {
        __typename: "InitiationViaIntraLedger" as const,
        counterPartyWalletId: "wallet-2",
        counterPartyUsername: null,
      },
      settlementVia: {
        __typename: "SettlementViaIntraLedger" as const,
        counterPartyWalletId: "wallet-2",
        counterPartyUsername: null,
        preImage: null,
      },
    }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.paymentType).toBe(PaymentType.Conversion)
  })

  it("maps IntraLedger without counterPartyWalletId as lightning", () => {
    const tx = {
      ...baseTx,
      initiationVia: {
        __typename: "InitiationViaIntraLedger" as const,
        counterPartyWalletId: null,
        counterPartyUsername: "user1",
      },
      settlementVia: {
        __typename: "SettlementViaIntraLedger" as const,
        counterPartyWalletId: null,
        counterPartyUsername: "user1",
        preImage: null,
      },
    }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.paymentType).toBe(PaymentType.Lightning)
  })

  it("maps USD wallet currency correctly", () => {
    const tx = { ...baseTx, settlementCurrency: WalletCurrency.Usd }
    const result = mapCustodialTransaction(tx, WalletCurrency.Usd)

    expect(result.amount.currency).toBe(WalletCurrency.Usd)
  })

  it("uses absolute value for amounts", () => {
    const tx = { ...baseTx, settlementAmount: -1000 }
    const result = mapCustodialTransaction(tx, WalletCurrency.Btc)

    expect(result.amount.amount).toBe(1000)
  })
})

describe("mapCustodialTransactions", () => {
  it("maps an array of transactions", () => {
    const txs = [baseTx, { ...baseTx, id: "tx-2" }]
    const result = mapCustodialTransactions(txs, WalletCurrency.Btc)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe("tx-1")
    expect(result[1].id).toBe("tx-2")
  })

  it("returns empty array for empty input", () => {
    const result = mapCustodialTransactions([], WalletCurrency.Btc)

    expect(result).toHaveLength(0)
  })
})
