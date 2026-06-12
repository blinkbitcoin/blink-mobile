import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { toUsdMoneyAmount } from "@app/types/amounts"
import { ThemeProvider } from "@rn-vui/themed"

const mockFormatMoneyAmount = jest.fn(
  ({
    moneyAmount,
    isApproximate,
  }: {
    moneyAmount: { amount: number; currency: string }
    isApproximate?: boolean
  }) => `${isApproximate ? "~ " : ""}${moneyAmount.currency}:${moneyAmount.amount}`,
)

const mockConvertMoneyAmount = jest.fn((_moneyAmount: unknown, toCurrency: string) => ({
  amount: 129184,
  currency: toCurrency,
  currencyCode: toCurrency,
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

const mockExecute = jest.fn()
const mockUseIntraLedgerConversion = jest.fn(() => ({
  execute: mockExecute,
  loading: false,
  errorMessage: undefined as string | undefined,
}))

jest.mock("@app/hooks/use-intra-ledger-conversion", () => ({
  useIntraLedgerConversion: () => mockUseIntraLedgerConversion(),
}))

import { UsdConvertToBtcModal } from "@app/components/usd-convert-to-btc-modal"

loadLocale("en")

const usdBalance = toUsdMoneyAmount(10001) // $100.01

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderModal = (props?: { toggleModal?: () => void; isVisible?: boolean }) =>
  render(
    wrap(
      <UsdConvertToBtcModal
        isVisible={props?.isVisible ?? true}
        toggleModal={props?.toggleModal ?? jest.fn()}
        usdWalletBalance={usdBalance}
        usdWalletId="usd-wallet-id"
        btcWalletId="btc-wallet-id"
      />,
    ),
  )

describe("UsdConvertToBtcModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIntraLedgerConversion.mockReturnValue({
      execute: mockExecute,
      loading: false,
      errorMessage: undefined,
    })
  })

  it("renders the title and body", () => {
    const { getByText } = renderModal()

    expect(getByText("Dollar account is no longer available in your region")).toBeTruthy()
    expect(getByText("Transfer your Dollar balance to Bitcoin")).toBeTruthy()
  })

  it("renders the You have and You get labels", () => {
    const { getByText } = renderModal()

    expect(getByText("You have")).toBeTruthy()
    expect(getByText("You get")).toBeTruthy()
  })

  it("shows the USD wallet balance as the You have value (not approximate)", () => {
    const { getByText } = renderModal()

    expect(mockFormatMoneyAmount).toHaveBeenCalledWith({ moneyAmount: usdBalance })
    expect(getByText("USD:10001")).toBeTruthy()
  })

  it("converts the balance to BTC and renders it as an approximate You get value", () => {
    const { getByText } = renderModal()

    expect(mockConvertMoneyAmount).toHaveBeenCalledWith(usdBalance, WalletCurrency.Btc)
    expect(mockFormatMoneyAmount).toHaveBeenCalledWith({
      moneyAmount: { amount: 129184, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      isApproximate: true,
    })
    expect(getByText("~ BTC:129184")).toBeTruthy()
  })

  it("triggers the conversion when Approve is pressed", () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Approve"))

    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it("renders the error box when the conversion reports an error", () => {
    mockUseIntraLedgerConversion.mockReturnValue({
      execute: mockExecute,
      loading: false,
      errorMessage: "Insufficient balance",
    })

    const { getByText } = renderModal()

    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = renderModal({ isVisible: false })

    expect(queryByText("Dollar account is no longer available in your region")).toBeNull()
  })

  it("shows the warning icon", () => {
    const { getByTestId } = renderModal()

    expect(getByTestId("icon-warning")).toBeTruthy()
  })

  it("renders no close icon button (dismissed via backdrop)", () => {
    const { queryByTestId } = renderModal()

    expect(queryByTestId("icon-close")).toBeNull()
  })
})
