import React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { WalletCurrency } from "../../graphql/generated"
import mocks from "../../graphql/mocks"
import {
  DisplayCurrency,
  MoneyAmount,
  WalletOrDisplayCurrency,
} from "../../types/amounts"
import {
  AmountInputScreen,
  AmountInputScreenProps,
  ConvertInputType,
} from "./amount-input-screen"

const STORY_TITLE = "Amount Input Screen"

export default {
  title: STORY_TITLE,
  component: AmountInputScreen,
  decorators: [
    (Story) => (
      <MockedProvider mocks={mocks} cache={createCache()}>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
} as Meta<typeof AmountInputScreen>

const amountInputDefaultProps: AmountInputScreenProps = {
  initialAmount: {
    amount: 0,
    currency: DisplayCurrency,
  },
  walletCurrency: WalletCurrency.Btc,
  onAmountChange: (amount: number) => {
    console.log("onAmountChange: ", amount)
  },
  convertMoneyAmount: (
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
    toCurrency: WalletOrDisplayCurrency,
  ) => {
    return {
      amount: moneyAmount.amount,
      currency: toCurrency,
    }
  },
  inputValues: {
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      amount: { amount: 0, currency: WalletCurrency.Btc },
      isFocused: false,
      formattedAmount: "",
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      amount: { amount: 0, currency: WalletCurrency.Usd },
      isFocused: false,
      formattedAmount: "",
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: DisplayCurrency,
      amount: { amount: 0, currency: DisplayCurrency },
      isFocused: false,
      formattedAmount: "",
    },
    formattedAmount: "",
  },
  onSetFormattedAmount: (values) => console.log("set formatted: ", values),
  focusedInput: null,
}

export const NoAmount = () => (
  <MockedProvider mocks={mocks} cache={createCache()}>
    <AmountInputScreen {...amountInputDefaultProps} />
  </MockedProvider>
)

const amountProps: AmountInputScreenProps = {
  ...amountInputDefaultProps,
  initialAmount: {
    amount: 100,
    currency: DisplayCurrency,
  },
}

export const Amount = () => (
  <MockedProvider mocks={mocks} cache={createCache()}>
    <AmountInputScreen {...amountProps} />
  </MockedProvider>
)

const maxAmountExceededProps: AmountInputScreenProps = {
  ...amountInputDefaultProps,
  initialAmount: {
    amount: 200,
    currency: DisplayCurrency,
  },
  maxAmount: {
    amount: 100,
    currency: DisplayCurrency,
  },
}

export const MaxAmountExceeded = () => (
  <MockedProvider mocks={mocks} cache={createCache()}>
    <AmountInputScreen {...maxAmountExceededProps} />
  </MockedProvider>
)

const noSecondaryCurrencyProps: AmountInputScreenProps = {
  ...amountInputDefaultProps,
  walletCurrency: WalletCurrency.Usd,
}

export const NoSecondaryCurrency = () => (
  <MockedProvider mocks={mocks} cache={createCache()}>
    <AmountInputScreen {...noSecondaryCurrencyProps} />
  </MockedProvider>
)
