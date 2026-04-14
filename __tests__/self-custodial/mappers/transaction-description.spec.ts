import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { WalletCurrency } from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet.types"

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
    conversionFromToken: jest.fn(
      ({ token }: { token: string }) => `Convert from ${token}`,
    ),
    conversionToToken: jest.fn(({ token }: { token: string }) => `Convert to ${token}`),
    conversionFromBitcoin: jest.fn(() => "Convert from Bitcoin"),
    conversionToBitcoin: jest.fn(() => "Convert to Bitcoin"),
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

  it("returns conversionFromToken for send conversion with token", () => {
    const tx = createTx({
      isConversion: true,
      tokenTicker: "USDB",
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Convert from USD")
  })

  it("returns conversionToToken for receive conversion with token", () => {
    const tx = createTx({
      isConversion: true,
      tokenTicker: "USDB",
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Convert to USD")
  })

  it("returns conversionFromBitcoin for send conversion without token", () => {
    const tx = createTx({
      isConversion: true,
      direction: TransactionDirection.Send,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Convert from Bitcoin")
  })

  it("returns conversionToBitcoin for receive conversion without token", () => {
    const tx = createTx({
      isConversion: true,
      direction: TransactionDirection.Receive,
    })
    expect(getTransactionDescription(tx, mockLL)).toBe("Convert to Bitcoin")
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
