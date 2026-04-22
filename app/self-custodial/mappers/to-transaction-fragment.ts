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

type DescriptionResolver = (tx: NormalizedTransaction) => string

type DisplayValues = {
  displayAmount: string
  displayCurrency: string
  displayFee: string
}

type ComputeDisplayInput = {
  signedAmount: number
  currency: WalletCurrency
  feeAmount: number
  feeCurrency: WalletCurrency
  display?: DisplayInfo
}

const STATUS_MAP: Record<TransactionStatus, TxStatus> = {
  [TransactionStatus.Completed]: TxStatus.Success,
  [TransactionStatus.Pending]: TxStatus.Pending,
  [TransactionStatus.Failed]: TxStatus.Failure,
}

const mapDirection = (direction: TransactionDirection): TxDirection =>
  direction === TransactionDirection.Send ? TxDirection.Send : TxDirection.Receive

const mapStatus = (status: TransactionStatus): TxStatus =>
  STATUS_MAP[status] ?? TxStatus.Failure

const wrapMoneyAmount = (
  amount: number,
  currency: WalletCurrency,
): MoneyAmount<WalletOrDisplayCurrency> => ({
  amount,
  currency,
  currencyCode: currency,
})

const formatInDisplayCurrency = (
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  display: DisplayInfo,
): string => {
  const converted = display.convertMoneyAmount(
    amount,
    display.displayCurrency as WalletOrDisplayCurrency,
  )
  const majorUnits = converted.amount / 10 ** display.fractionDigits
  return majorUnits.toFixed(display.fractionDigits)
}

const computeDisplay = ({
  signedAmount,
  currency,
  feeAmount,
  feeCurrency,
  display,
}: ComputeDisplayInput): DisplayValues => {
  if (!display) {
    return {
      displayAmount: `${Math.abs(signedAmount)}`,
      displayCurrency: currency,
      displayFee: `${feeAmount}`,
    }
  }
  return {
    displayAmount: formatInDisplayCurrency(
      wrapMoneyAmount(Math.abs(signedAmount), currency),
      display,
    ),
    displayCurrency: display.displayCurrency,
    displayFee: formatInDisplayCurrency(wrapMoneyAmount(feeAmount, feeCurrency), display),
  }
}

const createInitiationVia = (
  tx: NormalizedTransaction,
): TransactionFragment["initiationVia"] => {
  if (tx.paymentType === PaymentType.Onchain) {
    return { __typename: "InitiationViaOnChain", address: "" }
  }
  return { __typename: "InitiationViaLn", paymentHash: tx.id, paymentRequest: "" }
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

type FeeConversionInput = {
  rawAmount: number
  rawCurrency: WalletCurrency
  settlementCurrency: WalletCurrency
  display: DisplayInfo | undefined
}

const feeInSettlementCurrency = ({
  rawAmount,
  rawCurrency,
  settlementCurrency,
  display,
}: FeeConversionInput): number => {
  if (rawCurrency === settlementCurrency) return rawAmount
  if (!display) return 0
  return display.convertMoneyAmount(
    wrapMoneyAmount(rawAmount, rawCurrency),
    settlementCurrency,
  ).amount
}

export const toTransactionFragment = (
  tx: NormalizedTransaction,
  display?: DisplayInfo,
  resolveDescription?: DescriptionResolver,
): TransactionFragment => {
  const direction = mapDirection(tx.direction)
  const rawFeeAmount = tx.fee?.amount ?? 0
  const rawFeeCurrency = (tx.fee?.currency ?? WalletCurrency.Btc) as WalletCurrency
  const currency = tx.amount.currency as WalletCurrency

  const settlementFee = feeInSettlementCurrency({
    rawAmount: rawFeeAmount,
    rawCurrency: rawFeeCurrency,
    settlementCurrency: currency,
    display,
  })

  const totalAmount =
    direction === TxDirection.Send ? tx.amount.amount + settlementFee : tx.amount.amount
  const signedAmount = direction === TxDirection.Send ? -totalAmount : totalAmount

  const { displayAmount, displayCurrency, displayFee } = computeDisplay({
    signedAmount,
    currency,
    feeAmount: rawFeeAmount,
    feeCurrency: rawFeeCurrency,
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
    settlementFee,
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
