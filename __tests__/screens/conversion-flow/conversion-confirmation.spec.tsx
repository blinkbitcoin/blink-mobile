import React from "react"
import { ActivityIndicator, Text, TouchableOpacity } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { useNavigation } from "@react-navigation/native"

import { ConversionConfirmationScreen } from "@app/screens/conversion-flow"
import { WalletCurrency } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { toWalletId } from "@app/types/wallet"

import { ContextForScreen } from "../helper"

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

const baseWallets = [
  {
    id: toWalletId("btc-wallet-id"),
    walletCurrency: WalletCurrency.Btc,
    balance: toBtcMoneyAmount(100000),
    transactions: [],
  },
  {
    id: toWalletId("usd-wallet-id"),
    walletCurrency: WalletCurrency.Usd,
    balance: toUsdMoneyAmount(50000),
    transactions: [],
  },
]

const mockUseActiveWallet = jest.fn(() => ({
  isSelfCustodial: false,
  wallets: baseWallets,
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

const mockConversionExecution = jest.fn()

jest.mock("@app/screens/conversion-flow/hooks/use-conversion-execution", () => ({
  useConversionExecution: (...args: unknown[]) => mockConversionExecution(...args),
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

const buildRoute = (currency: WalletCurrency, amount: number) =>
  ({
    key: "conversionConfirmation",
    name: "conversionConfirmation",
    params: {
      fromWalletCurrency: currency,
      moneyAmount: { amount, currency, currencyCode: currency },
    },
  }) as const

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
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false, wallets: baseWallets })
    mockConversionExecution.mockReturnValue({
      isQuoting: false,
      hasQuoteError: false,
      feeText: "",
      hasFee: false,
      canExecute: true,
      execute: jest.fn().mockResolvedValue({ status: "success" }),
    })
  })

  it("renders BTC to USD texts", () => {
    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    const transferText = LL.ConversionConfirmationScreen.transferButtonText({
      fromWallet: LL.common.bitcoin(),
      toWallet: LL.common.dollar(),
    })
    const infoText = LL.ConversionConfirmationScreen.infoDollar()

    expect(priceConversionMock).toHaveBeenCalled()
    expect(displayCurrencyMock).toHaveBeenCalled()
    expect(screen.getByText(transferText)).toBeTruthy()
    expect(screen.getByText(infoText)).toBeTruthy()
  })

  it("renders USD to BTC texts", () => {
    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Usd, 5000)} />
      </ContextForScreen>,
    )

    const transferText = LL.ConversionConfirmationScreen.transferButtonText({
      fromWallet: LL.common.dollar(),
      toWallet: LL.common.bitcoin(),
    })
    const infoText = LL.ConversionConfirmationScreen.infoBitcoin()

    expect(screen.getByText(transferText)).toBeTruthy()
    expect(screen.getByText(infoText)).toBeTruthy()
  })

  it("shows conversion rate", () => {
    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    expect(screen.getByText("1 BTC = $100000000")).toBeTruthy()
  })

  it("shows from and to amounts", () => {
    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    expect(screen.getAllByText("$10000").length).toBeGreaterThanOrEqual(2)
  })

  it("invokes conversion.execute and resets to conversionSuccess on success", async () => {
    const execute = jest.fn().mockResolvedValue({ status: "success" })
    mockConversionExecution.mockReturnValue({
      isQuoting: false,
      hasQuoteError: false,
      feeText: "$0.00",
      hasFee: false,
      canExecute: true,
      execute,
    })

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    fireEvent.press(
      screen.getByText(
        LL.ConversionConfirmationScreen.transferButtonText({
          fromWallet: LL.common.bitcoin(),
          toWallet: LL.common.dollar(),
        }),
      ),
    )

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(dispatchMock).toHaveBeenCalled()
  })

  it("does not navigate when conversion.execute reports failure", async () => {
    const execute = jest.fn().mockResolvedValue({
      status: "failed",
      message: "Conversion rejected",
    })
    mockConversionExecution.mockReturnValue({
      isQuoting: false,
      hasQuoteError: false,
      feeText: "",
      hasFee: false,
      canExecute: true,
      execute,
    })

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Usd, 5000)} />
      </ContextForScreen>,
    )

    fireEvent.press(
      screen.getByText(
        LL.ConversionConfirmationScreen.transferButtonText({
          fromWallet: LL.common.dollar(),
          toWallet: LL.common.bitcoin(),
        }),
      ),
    )

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(screen.getByText("Conversion rejected")).toBeTruthy()
  })

  it("renders the fee row only when the quote has a non-zero fee", () => {
    mockConversionExecution.mockReturnValue({
      isQuoting: false,
      hasQuoteError: false,
      feeText: "$0.05",
      hasFee: true,
      canExecute: true,
      execute: jest.fn(),
    })

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    expect(screen.getByText("$0.05")).toBeTruthy()
  })

  it("does not render the fee row when the quote has zero fee (custodial intra-ledger)", () => {
    mockConversionExecution.mockReturnValue({
      isQuoting: false,
      hasQuoteError: false,
      feeText: "$0.00",
      hasFee: false,
      canExecute: true,
      execute: jest.fn(),
    })

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    expect(screen.queryByText("$0.00")).toBeNull()
  })

  it("renders the fee row with a spinner while the quote is loading", () => {
    mockConversionExecution.mockReturnValue({
      isQuoting: true,
      hasQuoteError: false,
      feeText: "",
      hasFee: false,
      canExecute: false,
      execute: jest.fn(),
    })

    render(
      <ContextForScreen>
        <ConversionConfirmationScreen route={buildRoute(WalletCurrency.Btc, 10000)} />
      </ContextForScreen>,
    )

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })
})
