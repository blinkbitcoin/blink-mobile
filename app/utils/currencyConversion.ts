const isCurrencyWithDecimals = (currency) => {
  // LEE :: We don't want to have decimals in our colones
  return false
  return currency === "USD"
}

// Extracted from: https://github.com/ianmcnally/react-currency-masked-input/blob/3989ce3dfa69dbf78da00424811376c483aceb98/src/services/currency-conversion.js
export const textToCurrency = (
  value: string,
  currency: CurrencyType,
  separator = ".",
): string => {
  if (isCurrencyWithDecimals(currency)) {
    const digits = getDigitsFromValue(value)
    return addDecimalToNumber(digits, separator)
  } else {
    return value
  }
}

export const currencyToTextWithUnits = (moneyAmount: MoneyAmount): string => {
  if (moneyAmount.currency === "BTC") {
    if (moneyAmount.value === 1) {
      return "1 sat"
    }
    return currencyToText(moneyAmount.value.toString(), moneyAmount.currency) + " sats"
  }

  if (moneyAmount.currency === "USD") {
    return "₡" + currencyToText(moneyAmount.value.toString(), moneyAmount.currency)
  }
  throw Error("wrong currency")
}

export const currencyToText = (
  value: string,
  currency: CurrencyType,
  locale = "es-CR",
): string =>
  isCurrencyWithDecimals(currency)
    ? Number(value).toLocaleString(locale, {
        currency: "CRC",
        style: "decimal",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : Number(value).toLocaleString(locale, {
        style: "decimal",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      })

const getDigitsFromValue = (value = "") => value.replace(/(-(?!\d))|[^0-9|-]/g, "") || ""

const removeLeadingZeros = (number) => number.replace(/^0+([0-9]+)/, "$1")

const addDecimalToNumber = (number: string, separator: string) => {
  const fractionsStartingPosition = number.length - 2
  const integerDigits = removeLeadingZeros(number.substring(0, fractionsStartingPosition))
  const fractionDigits = number.substring(fractionsStartingPosition)
  return integerDigits + separator + fractionDigits
}
