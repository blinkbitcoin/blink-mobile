import {
  TxDirection,
  TxStatus,
  WalletCurrency,
  type TransactionFragment,
} from "@app/graphql/generated"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  TransactionDirection,
  TransactionStatus,
  PaymentType,
  type NormalizedTransaction,
} from "@app/types/transaction.types"

type ConvertFn = (
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: WalletOrDisplayCurrency,
) => MoneyAmount<WalletOrDisplayCurrency>

type DisplayInfo = {
  displayCurrency: string
  convertMoneyAmount: ConvertFn
  fractionDigits: number
}

const mapDirection = (direction: TransactionDirection): TxDirection =>
  direction === TransactionDirection.Send ? TxDirection.Send : TxDirection.Receive

const mapStatus = (status: TransactionStatus): TxStatus => {
  if (status === TransactionStatus.Completed) return TxStatus.Success
  if (status === TransactionStatus.Pending) return TxStatus.Pending
  return TxStatus.Failure
}

const createInitiationVia = (
  tx: NormalizedTransaction,
): TransactionFragment["initiationVia"] => {
  if (tx.paymentType === PaymentType.Onchain) {
    return { __typename: "InitiationViaOnChain", address: "" }
  }
  return {
    __typename: "InitiationViaLn",
    paymentHash: tx.id,
    paymentRequest: "",
  }
}

const createSettlementVia = (
  tx: NormalizedTransaction,
): TransactionFragment["settlementVia"] => {
  if (tx.paymentType === PaymentType.Onchain) {
    return {
      __typename: "SettlementViaOnChain",
      transactionHash: tx.id,
      arrivalInMempoolEstimatedAt: null,
    }
  }
  return { __typename: "SettlementViaLn", preImage: null }
}

type ComputeDisplayInput = {
  signedAmount: number
  currency: WalletCurrency
  feeAmount: number
  display?: DisplayInfo
}

const computeDisplay = ({
  signedAmount,
  currency,
  feeAmount,
  display,
}: ComputeDisplayInput): {
  displayAmount: string
  displayCurrency: string
  displayFee: string
} => {
  if (!display) {
    return {
      displayAmount: `${Math.abs(signedAmount)}`,
      displayCurrency: currency,
      displayFee: `${feeAmount}`,
    }
  }

  const settlementInWalletCurrency: MoneyAmount<WalletOrDisplayCurrency> = {
    amount: Math.abs(signedAmount),
    currency,
    currencyCode: currency,
  }

  const converted = display.convertMoneyAmount(
    settlementInWalletCurrency,
    display.displayCurrency as WalletOrDisplayCurrency,
  )
  const majorUnits = converted.amount / 10 ** display.fractionDigits
  const displayAmount = majorUnits.toFixed(display.fractionDigits)

  const feeInWalletCurrency: MoneyAmount<WalletOrDisplayCurrency> = {
    amount: feeAmount,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }
  const convertedFee = display.convertMoneyAmount(
    feeInWalletCurrency,
    display.displayCurrency as WalletOrDisplayCurrency,
  )
  const feeMajor = convertedFee.amount / 10 ** display.fractionDigits
  const displayFee = feeMajor.toFixed(display.fractionDigits)

  return { displayAmount, displayCurrency: display.displayCurrency, displayFee }
}

type DescriptionResolver = (tx: NormalizedTransaction) => string

export const toTransactionFragment = (
  tx: NormalizedTransaction,
  display?: DisplayInfo,
  resolveDescription?: DescriptionResolver,
): TransactionFragment => {
  const direction = mapDirection(tx.direction)
  const feeAmount = tx.fee?.amount ?? 0
  const totalAmount =
    direction === TxDirection.Send ? tx.amount.amount + feeAmount : tx.amount.amount
  const signedAmount = direction === TxDirection.Send ? -totalAmount : totalAmount
  const currency = tx.amount.currency as WalletCurrency

  const { displayAmount, displayCurrency, displayFee } = computeDisplay({
    signedAmount,
    currency,
    feeAmount,
    display,
  })

  return {
    __typename: "Transaction",
    id: tx.id,
    status: mapStatus(tx.status),
    direction,
    memo: resolveDescription ? resolveDescription(tx) : tx.memo ?? null,
    createdAt: tx.timestamp,
    settlementAmount: signedAmount,
    settlementFee: feeAmount,
    settlementDisplayFee: displayFee,
    settlementCurrency: currency,
    settlementDisplayAmount: displayAmount,
    settlementDisplayCurrency: displayCurrency,
    settlementPrice: {
      __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
      base: 1,
      offset: 0,
      currencyUnit: currency === WalletCurrency.Btc ? "BTCSAT" : "USDCENT",
      formattedAmount: displayAmount,
    },
    initiationVia: createInitiationVia(tx),
    settlementVia: createSettlementVia(tx),
  }
}

export const toTransactionFragments = (
  txs: NormalizedTransaction[],
  display?: DisplayInfo,
  resolveDescription?: DescriptionResolver,
): TransactionFragment[] =>
  txs.map((tx) => toTransactionFragment(tx, display, resolveDescription))
