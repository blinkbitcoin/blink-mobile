import React from "react"
import { Text, TouchableOpacity } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { useNavigation } from "@react-navigation/native"

import { ConversionConfirmationScreen } from "@app/screens/conversion-flow"
import { HomeAuthedDocument, WalletCurrency } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

const conversionQueryMock = jest.fn(() => ({
  data: {
    me: {
      id: "user-id",
      defaultAccount: {
        id: "account-id",
        wallets: [
          {
            id: "btc-wallet-id",
            walletCurrency: "BTC",
            balance: 100000,
            __typename: "BTCWallet",
          },
          {
            id: "usd-wallet-id",
            walletCurrency: "USD",
            balance: 5000,
            __typename: "UsdWallet",
          },
        ],
        __typename: "ConsumerAccount",
      },
      __typename: "User",
    },
  },
}))

const intraLedgerMutationMock = jest.fn(() =>
  Promise.resolve({
    data: {
      intraLedgerPaymentSend: {
        status: "SUCCESS",
        errors: [],
      },
    },
  }),
)

const intraLedgerUsdMutationMock = jest.fn(() =>
  Promise.resolve({
    data: {
      intraLedgerUsdPaymentSend: {
        status: "SUCCESS",
        errors: [],
      },
    },
  }),
)

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useConversionScreenQuery: () => conversionQueryMock(),
    useIntraLedgerPaymentSendMutation: () => [
      intraLedgerMutationMock,
      { loading: false },
    ],
    useIntraLedgerUsdPaymentSendMutation: () => [
      intraLedgerUsdMutationMock,
      { loading: false },
    ],
  }
})

const priceConversionMock = jest.fn(() => ({
  convertMoneyAmount: (
    moneyAmount: { amount: number; currency: string; currencyCode?: string },
    toCurrency: WalletCurrency,
  ) => ({
    amount: moneyAmount.amount,
    currency: toCurrency,
    currencyCode: toCurrency,
  }),
  displayCurrency: "USD",
  toDisplayMoneyAmount: () => ({ amount: 1, currency: "USD" }),
  usdPerSat: "0.00000001",
}))

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")
  return {
    ...actual,
    usePriceConversion: () => priceConversionMock(),
    SATS_PER_BTC: 100000000,
  }
})

const displayCurrencyMock = jest.fn(() => ({
  displayCurrency: "USD",
  formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${moneyAmount.amount}`,
  moneyAmountToDisplayCurrencyString: ({
    moneyAmount,
  }: {
    moneyAmount: { amount: number }
  }) => `$${moneyAmount.amount}`,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => displayCurrencyMock(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@app/utils/analytics", () => ({
  logConversionAttempt: jest.fn(),
  logConversionResult: jest.fn(),
}))

jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", () => {
  type Props = { onSwipe: () => void; initialText: string }

  const MockGaloySliderButton = ({ onSwipe, initialText }: Props) => (
    <TouchableOpacity onPress={onSwipe}>
      <Text>{initialText}</Text>
    </TouchableOpacity>
  )

  return { __esModule: true, default: MockGaloySliderButton }
})

describe("conversion-confirmation-screen", () => {
  let LL: ReturnType<typeof i18nObject>
  const dispatchMock = jest.fn()

  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    LL = i18nObject("en")
    jest.clearAllMocks()
    ;(useNavigation as jest.Mock).mockReturnValue({ dispatch: dispatchMock })
  })

  it("renders BTC to USD texts", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Btc,
        moneyAmount: {
          amount: 10000,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    const transferText = LL.ConversionConfirmationScreen.transferButtonText({
      fromWallet: WalletCurrency.Btc,
      toWallet: WalletCurrency.Usd,
    })
    const infoText = LL.ConversionConfirmationScreen.infoDollar()

    expect(conversionQueryMock).toHaveBeenCalled()
    expect(priceConversionMock).toHaveBeenCalled()
    expect(displayCurrencyMock).toHaveBeenCalled()

    expect(screen.getByText(transferText)).toBeTruthy()
    expect(screen.getByText(infoText)).toBeTruthy()
  })

  it("renders USD to BTC texts", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Usd,
        moneyAmount: {
          amount: 5000,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    const transferText = LL.ConversionConfirmationScreen.transferButtonText({
      fromWallet: WalletCurrency.Usd,
      toWallet: WalletCurrency.Btc,
    })
    const infoText = LL.ConversionConfirmationScreen.infoBitcoin()

    expect(screen.getByText(transferText)).toBeTruthy()
    expect(screen.getByText(infoText)).toBeTruthy()
  })

  it("shows conversion rate", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Btc,
        moneyAmount: {
          amount: 10000,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    expect(screen.getByText("1 BTC = $100000000")).toBeTruthy()
  })

  it("shows from and to amounts for BTC to USD", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Btc,
        moneyAmount: {
          amount: 10000,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    expect(screen.getAllByText("$10000").length).toBeGreaterThanOrEqual(2)
  })

  it("sends BTC conversion on swipe", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Btc,
        moneyAmount: {
          amount: 10000,
          currency: WalletCurrency.Btc,
          currencyCode: WalletCurrency.Btc,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(
      screen.getByText(
        LL.ConversionConfirmationScreen.transferButtonText({
          fromWallet: WalletCurrency.Btc,
          toWallet: WalletCurrency.Usd,
        }),
      ),
    )

    await waitFor(() => {
      expect(intraLedgerMutationMock).toHaveBeenCalledWith({
        variables: {
          input: {
            walletId: "btc-wallet-id",
            recipientWalletId: "usd-wallet-id",
            amount: 10000,
          },
        },
        refetchQueries: [HomeAuthedDocument],
      })
    })

    expect(dispatchMock).toHaveBeenCalled()
  })

  it("sends USD conversion on swipe", async () => {
    const route = {
      key: "conversionConfirmation",
      name: "conversionConfirmation",
      params: {
        fromWalletCurrency: WalletCurrency.Usd,
        moneyAmount: {
          amount: 5000,
          currency: WalletCurrency.Usd,
          currencyCode: WalletCurrency.Usd,
        },
      },
    } as const

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(
      screen.getByText(
        LL.ConversionConfirmationScreen.transferButtonText({
          fromWallet: WalletCurrency.Usd,
          toWallet: WalletCurrency.Btc,
        }),
      ),
    )

    await waitFor(() => {
      expect(intraLedgerUsdMutationMock).toHaveBeenCalledWith({
        variables: {
          input: {
            walletId: "usd-wallet-id",
            recipientWalletId: "btc-wallet-id",
            amount: 5000,
          },
        },
        refetchQueries: [HomeAuthedDocument],
      })
    })

    expect(dispatchMock).toHaveBeenCalled()
  })
})
