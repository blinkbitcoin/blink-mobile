import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

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
let mockConvertReady = true

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertReady ? mockConvertMoneyAmount : undefined,
  }),
}))

const mockModalRender = jest.fn()

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = (props: { children: React.ReactNode; isVisible: boolean }) => {
    mockModalRender(props)
    return props.isVisible ? ReactNs.createElement(RN.View, null, props.children) : null
  }
  return { __esModule: true, default: MockModal }
})

import { ConvertToBtcModalUI } from "@app/components/usd-convert-to-btc-modal"

loadLocale("en")

const usdBalance = toUsdMoneyAmount(10001) // $100.01

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

type OptionalProps = {
  isVisible?: boolean
  toggleModal?: () => void
  onConvert?: () => void
  loading?: boolean
  dismissable?: boolean
  errorMessage?: string
}

const renderUI = (props?: OptionalProps) =>
  render(
    wrap(
      <ConvertToBtcModalUI
        isVisible={props?.isVisible ?? true}
        toggleModal={props?.toggleModal ?? jest.fn()}
        usdWalletBalance={usdBalance}
        onConvert={props?.onConvert ?? jest.fn()}
        loading={props?.loading ?? false}
        dismissable={props?.dismissable}
        errorMessage={props?.errorMessage}
      />,
    ),
  )

describe("ConvertToBtcModalUI", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertReady = true
  })

  it("renders the title, body and both amount rows", () => {
    const { getByText } = renderUI()

    expect(getByText("Dollar Balance is not available in your region")).toBeTruthy()
    expect(getByText("Transfer from Dollar Balance to Bitcoin Balance")).toBeTruthy()
    expect(getByText("You have")).toBeTruthy()
    expect(getByText("You get")).toBeTruthy()
  })

  it("shows the exact balance and the approximate bitcoin estimate", () => {
    const { getByText } = renderUI()

    expect(mockFormatMoneyAmount).toHaveBeenCalledWith({ moneyAmount: usdBalance })
    expect(getByText("USD:10001")).toBeTruthy()
    expect(getByText("~ BTC:129184")).toBeTruthy()
  })

  it("hides the bitcoin estimate while the price conversion is unavailable", () => {
    mockConvertReady = false
    const { getByText, queryByText } = renderUI()

    expect(getByText("You get")).toBeTruthy()
    expect(queryByText("~ BTC:129184")).toBeNull()
  })

  it("shows the warning icon", () => {
    const { getByTestId } = renderUI()

    expect(getByTestId("icon-warning")).toBeTruthy()
  })

  it("forwards the visibility to the modal", () => {
    renderUI({ isVisible: false })

    expect(mockModalRender).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    )
  })

  it("calls onConvert when Transfer is pressed", () => {
    const onConvert = jest.fn()
    const { getByText } = renderUI({ onConvert })

    fireEvent.press(getByText("Transfer"))

    expect(onConvert).toHaveBeenCalledTimes(1)
  })

  it("disables Transfer while loading", () => {
    const { queryByText, getByRole } = renderUI({ loading: true })

    expect(queryByText("Transfer")).toBeNull()
    expect(getByRole("button", { disabled: true })).toBeTruthy()
  })

  it("renders the error box when an error message is provided", () => {
    const { getByText } = renderUI({ errorMessage: "Insufficient balance" })

    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("is locked by default: no close icon", () => {
    const { queryByTestId } = renderUI()

    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("shows the close icon and closes through it when dismissable", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = renderUI({ dismissable: true, toggleModal })

    fireEvent.press(getByTestId("icon-close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })
})
