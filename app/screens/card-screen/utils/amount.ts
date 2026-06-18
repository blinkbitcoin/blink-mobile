const numberFormatter = Intl.NumberFormat("en-US")

export const createCurrencyFormatters = (currencySymbol: string) => ({
  formatAmount: (amount: string) =>
    `${currencySymbol}${numberFormatter.format(Number(amount) || 0)}`,
})
