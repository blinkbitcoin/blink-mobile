import { WalletCurrency } from "@app/graphql/generated"

export const DisplayCurrency = "DisplayCurrency" as const
export type DisplayCurrency = typeof DisplayCurrency

export type DisplayAmount = MoneyAmount<DisplayCurrency>

export type WalletOrDisplayCurrency = WalletCurrency | DisplayCurrency

export const moneyAmountIsCurrencyType = <T extends WalletOrDisplayCurrency>(
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
  currency: T,
): moneyAmount is MoneyAmount<T> => {
  return moneyAmount.currency === currency
}

export type MoneyAmount<T extends WalletOrDisplayCurrency> = {
  amount: number
  currency: T
  currencyCode: string
}

export type WalletAmount<T extends WalletCurrency> = MoneyAmount<T>

export type UsdMoneyAmount = WalletAmount<typeof WalletCurrency.Usd>
export type BtcMoneyAmount = WalletAmount<typeof WalletCurrency.Btc>

export const ZeroUsdMoneyAmount: UsdMoneyAmount = {
  amount: 0,
  currency: WalletCurrency.Usd,
  currencyCode: "USD",
}

export const ZeroBtcMoneyAmount: BtcMoneyAmount = {
  amount: 0,
  currency: WalletCurrency.Btc,
  currencyCode: "BTC",
}

export const toBtcMoneyAmount = (amount: number | undefined): BtcMoneyAmount => {
  if (amount === undefined) {
    return {
      amount: NaN,
      currency: WalletCurrency.Btc,
      currencyCode: "BTC",
    }
  }
  return {
    amount,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC",
  }
}

export const toUsdMoneyAmount = (amount: number | undefined): UsdMoneyAmount => {
  if (amount === undefined) {
    return {
      amount: NaN,
      currency: WalletCurrency.Usd,
      currencyCode: "USD",
    }
  }
  return {
    amount,
    currency: WalletCurrency.Usd,
    currencyCode: "USD",
  }
}

export const toWalletMoneyAmount = (
  amount: number,
  currency: WalletCurrency,
): MoneyAmount<WalletCurrency> => {
  if (currency === WalletCurrency.Btc) return toBtcMoneyAmount(Math.abs(amount))
  return toUsdMoneyAmount(Math.abs(amount))
}

export const toSatsAmount = (
  amount: MoneyAmount<WalletOrDisplayCurrency>,
  convert: (
    amount: MoneyAmount<WalletOrDisplayCurrency>,
    currency: WalletCurrency,
  ) => MoneyAmount<WalletCurrency>,
): number => convert(amount, WalletCurrency.Btc).amount

const DISPLAY_DECIMALS = 2

export const tokenBaseUnitsToCents = (
  rawAmount: number,
  tokenDecimals: number,
): number => {
  const excessDecimals = Math.max(tokenDecimals - DISPLAY_DECIMALS, 0)
  return Math.round(rawAmount / 10 ** excessDecimals)
}

export const centsToTokenBaseUnits = (cents: number, tokenDecimals: number): number => {
  const excessDecimals = Math.max(tokenDecimals - DISPLAY_DECIMALS, 0)
  return Math.round(cents * 10 ** excessDecimals)
}

export const toWalletAmount = <T extends WalletCurrency>({
  amount,
  currency,
}: {
  amount: number | undefined
  currency: T
}): WalletAmount<T> => {
  if (amount === undefined) {
    return {
      amount: NaN,
      currency,
      currencyCode: currency,
    }
  }
  return {
    amount,
    currency,
    currencyCode: currency,
  }
}

export const toDisplayAmount = ({
  amount,
  currencyCode,
}: {
  amount: number | undefined
  currencyCode: string
}): DisplayAmount => {
  if (amount === undefined) {
    return {
      amount: NaN,
      currency: DisplayCurrency,
      currencyCode,
    }
  }
  return {
    amount,
    currency: DisplayCurrency,
    currencyCode,
  }
}

export const createToDisplayAmount =
  (currencyCode: string) =>
  (amount: number | undefined): DisplayAmount => {
    return toDisplayAmount({ amount, currencyCode })
  }

export const lessThanOrEqualTo = <T extends WalletOrDisplayCurrency>({
  value,
  lessThanOrEqualTo,
}: {
  value: MoneyAmount<T>
  lessThanOrEqualTo: MoneyAmount<T>
}) => {
  return value.amount <= lessThanOrEqualTo.amount
}

export const lessThan = <T extends WalletOrDisplayCurrency>({
  value,
  lessThan,
}: {
  value: MoneyAmount<T>
  lessThan: MoneyAmount<T>
}) => {
  return value.amount < lessThan.amount
}

export const greaterThan = <T extends WalletOrDisplayCurrency>({
  value,
  greaterThan,
}: {
  value: MoneyAmount<T>
  greaterThan: MoneyAmount<T>
}) => {
  return value.amount > greaterThan.amount
}

export const greaterThanOrEqualTo = <T extends WalletOrDisplayCurrency>({
  value,
  greaterThanOrEqualTo,
}: {
  value: MoneyAmount<T>
  greaterThanOrEqualTo: MoneyAmount<T>
}) => {
  return value.amount >= greaterThanOrEqualTo.amount
}

export const addMoneyAmounts = <T extends WalletOrDisplayCurrency>({
  a,
  b,
}: {
  a: MoneyAmount<T>
  b: MoneyAmount<T>
}): MoneyAmount<T> => {
  return {
    amount: a.amount + b.amount,
    currency: a.currency,
    currencyCode: a.currencyCode,
  }
}

export const multiplyMoneyAmounts = <T extends WalletOrDisplayCurrency>({
  value,
  multiplier,
}: {
  value: MoneyAmount<T>
  multiplier: number
}): MoneyAmount<T> => {
  return {
    amount: value.amount * multiplier,
    currency: value.currency,
    currencyCode: value.currencyCode,
  }
}

export const subtractMoneyAmounts = <T extends WalletOrDisplayCurrency>({
  a,
  b,
}: {
  a: MoneyAmount<T>
  b: MoneyAmount<T>
}): MoneyAmount<T> => {
  return {
    amount: a.amount - b.amount,
    currency: a.currency,
    currencyCode: a.currencyCode,
  }
}

export const isNonZeroMoneyAmount = (
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency> | undefined,
): moneyAmount is MoneyAmount<WalletOrDisplayCurrency> => {
  return moneyAmount !== undefined && moneyAmount.amount !== 0
}
