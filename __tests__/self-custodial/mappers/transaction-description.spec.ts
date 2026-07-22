import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"
import { WalletCurrency } from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"

import { getTransactionDescription } from "@app/self-custodial/mappers/transaction-description"

const createTx = (
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  id: "tx-1",
  amount: {
    amount: 1000,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  direction: TransactionDirection.Send,
  status: TransactionStatus.Completed,
  timestamp: 1700000000,
  paymentType: PaymentType.Lightning,
  sourceAccountType: AccountType.SelfCustodial,
  ...overrides,
})

const mockLL = {
  TransactionDescription: {
    payTo: jest.fn(({ address }: { address: string }) => `Pay to ${address}`),
    transferFromTokenBalance: jest.fn(
      ({ token }: { token: string }) => `Transfer from ${token} balance`,
    ),
    transferToTokenBalance: jest.fn(
      ({ token }: { token: string }) => `Transfer to ${token} balance`,
    ),
    transferFromBitcoinBalance: jest.fn(() => "Transfer from Bitcoin balance"),
    transferToBitcoinBalance: jest.fn(() => "Transfer to Bitcoin balance"),
    tokenTransfer: jest.fn(({ token }: { token: string }) => `${token} transfer`),
    lightningPayment: jest.fn(() => "Lightning payment"),
    sparkTransfer: jest.fn(() => "Spark transfer"),
    onchainWithdrawal: jest.fn(() => "On-chain withdrawal"),
    onchainDeposit: jest.fn(() => "On-chain deposit"),
    payment: jest.fn(() => "Payment"),
  },
} as never

describe("getTransactionDescription", () => {
  it("returns memo when present", () => {
    const tx = createTx({ memo: "Coffee payment" })
    expect(getTransactionDescription(tx, mockLL)).toBe("Coffee payment")
  })

  it("trims memo whitespace", () => {
    const tx = createTx({ memo: "  " })
    expect(getTransactionDescription(tx, mockLL)).not.toBe("  ")
  })

  it("returns lnAddress for receive", () => {
    const tx = createTx({
      lnAddress: "user@wallet.com",
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("user@wallet.com")
  })

  it("returns payTo for send with lnAddress", () => {
    const tx = createTx({
      lnAddress: "user@wallet.com",
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Pay to user@wallet.com")
  })

  it("returns transferFromTokenBalance for send conversion with token", () => {
    const tx = createTx({
      isConversion: true,
      tokenTicker: "USDB",
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Transfer from USD")
  })

  it("returns transferToTokenBalance for receive conversion with token", () => {
    const tx = createTx({
      isConversion: true,
      tokenTicker: "USDB",
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Transfer to USD balance")
  })

  it("returns transferFromBitcoinBalance for send conversion without token", () => {
    const tx = createTx({
      isConversion: true,
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Transfer from Bitcoin balance")
  })

  it("returns transferToBitcoinBalance for receive conversion without token", () => {
    const tx = createTx({
      isConversion: true,
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Transfer to Bitcoin balance")
  })

  it("returns tokenTransfer when tokenTicker present (no conversion)", () => {
    const tx = createTx({ tokenTicker: "USDB" })
    expect(getTransactionDescription(tx, mockLL)).toBe("USD transfer")
  })

  it("returns lightningPayment for Lightning type", () => {
    const tx = createTx({ paymentType: PaymentType.Lightning })
    expect(getTransactionDescription(tx, mockLL)).toBe("Lightning payment")
  })

  it("returns sparkTransfer for Spark type", () => {
    const tx = createTx({ paymentType: PaymentType.Spark })
    expect(getTransactionDescription(tx, mockLL)).toBe("Spark transfer")
  })

  it("returns onchainWithdrawal for Onchain send", () => {
    const tx = createTx({
      paymentType: PaymentType.Onchain,
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("On-chain withdrawal")
  })

  it("returns onchainDeposit for Onchain receive", () => {
    const tx = createTx({
      paymentType: PaymentType.Onchain,
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("On-chain deposit")
  })

  it("returns generic payment as fallback", () => {
    const tx = createTx({ paymentType: "unknown" as PaymentType })
    expect(getTransactionDescription(tx, mockLL)).toBe("Payment")
  })
})
