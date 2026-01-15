import { useEffect, useState } from "react"

import { WalletCurrency, Wallet } from "@app/graphql/generated"
import { ConvertInputType } from "@app/components/transfer-amount-input"
import {
  DisplayCurrency,
  toBtcMoneyAmount,
  toDisplayAmount,
  toUsdMoneyAmount,
} from "@app/types/amounts"
import { InputValues } from "@app/screens/conversion-flow/use-convert-money-details"

type WalletFragment = Pick<Wallet, "id" | "balance" | "walletCurrency">

type UseSyncedInputValuesParams = {
  fromWallet?: WalletFragment
  toWallet?: WalletFragment
  displayCurrency: string
}

export const useSyncedInputValues = ({
  fromWallet,
  toWallet,
  displayCurrency,
}: UseSyncedInputValuesParams) => {
  const [inputValues, setInputValues] = useState<InputValues>({
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      amount: toBtcMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      amount: toUsdMoneyAmount(0),
      isFocused: false,
      formattedAmount: "",
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: displayCurrency as DisplayCurrency,
      amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
      isFocused: false,
      formattedAmount: "",
    },
    formattedAmount: "",
  })

  useEffect(() => {
    if (fromWallet && toWallet) {
      setInputValues((prev) => {
        const fromCurrency = fromWallet.walletCurrency
        const toCurrency = toWallet.walletCurrency
        const fromAmount =
          fromCurrency === WalletCurrency.Btc
            ? toBtcMoneyAmount(prev.fromInput.amount.amount)
            : toUsdMoneyAmount(prev.fromInput.amount.amount)
        const toAmount =
          toCurrency === WalletCurrency.Btc
            ? toBtcMoneyAmount(prev.toInput.amount.amount)
            : toUsdMoneyAmount(prev.toInput.amount.amount)

        return {
          ...prev,
          fromInput: {
            ...prev.fromInput,
            currency: fromCurrency,
            amount: fromAmount,
          },
          toInput: {
            ...prev.toInput,
            currency: toCurrency,
            amount: toAmount,
          },
        }
      })
    }
  }, [fromWallet, fromWallet?.walletCurrency, toWallet, toWallet?.walletCurrency])

  return { inputValues, setInputValues }
}
