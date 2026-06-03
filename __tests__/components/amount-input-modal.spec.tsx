import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AmountInputModal } from "@app/components/amount-input/amount-input-modal"

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({
    overlay: {},
    sheetContent: {},
    handleIndicator: {},
  }),
}))

let capturedAmountInputScreenProps: Record<string, unknown> = {}

jest.mock("@app/components/amount-input-screen", () => ({
  AmountInputScreen: (props: Record<string, unknown>) => {
    capturedAmountInputScreenProps = props
    const RN = jest.requireActual("react-native")
    return <RN.View testID="amount-input-screen" />
  },
}))

describe("AmountInputModal", () => {
  const mockClose = jest.fn()
  const mockOnSetAmount = jest.fn()
  const mockConvertMoneyAmount = jest.fn()

  const defaultProps = {
    walletCurrency: WalletCurrency.Btc,
    convertMoneyAmount: mockConvertMoneyAmount,
    isOpen: true,
    close: mockClose,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedAmountInputScreenProps = {}
  })

  it("renders AmountInputScreen inside the modal when open", () => {
    const { getByTestId } = render(<AmountInputModal {...defaultProps} />)

    expect(getByTestId("amount-input-screen")).toBeTruthy()
  })

  it("calls close on Android back dismiss (onRequestClose)", () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = render(<AmountInputModal {...defaultProps} />)
    const Modal = jest.requireActual("react-native").Modal

    // eslint-disable-next-line camelcase
    fireEvent(UNSAFE_getByType(Modal), "requestClose")

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("passes moneyAmount as initialAmount", () => {
    const moneyAmount = {
      amount: 500,
      currency: WalletCurrency.Btc,
      currencyCode: "SAT",
    }

    render(<AmountInputModal {...defaultProps} moneyAmount={moneyAmount} />)

    expect(capturedAmountInputScreenProps.initialAmount).toBe(moneyAmount)
  })

  it("passes maxAmount and minAmount through", () => {
    const maxAmount = {
      amount: 10000,
      currency: "DisplayCurrency" as const,
      currencyCode: "USD",
    }
    const minAmount = {
      amount: 100,
      currency: "DisplayCurrency" as const,
      currencyCode: "USD",
    }

    render(
      <AmountInputModal
        {...defaultProps}
        maxAmount={maxAmount}
        maxAmountIsBalance
        minAmount={minAmount}
      />,
    )

    expect(capturedAmountInputScreenProps.maxAmount).toBe(maxAmount)
    expect(capturedAmountInputScreenProps.maxAmountIsBalance).toBe(true)
    expect(capturedAmountInputScreenProps.minAmount).toBe(minAmount)
  })

  it("calls onSetAmount and close when AmountInputScreen submits an amount", () => {
    render(<AmountInputModal {...defaultProps} onSetAmount={mockOnSetAmount} />)

    const setAmountFn = capturedAmountInputScreenProps.setAmount as (
      amount: Record<string, unknown>,
    ) => void
    expect(setAmountFn).toBeDefined()

    const amount = { amount: 100, currency: "BTC", currencyCode: "SAT" }
    setAmountFn(amount)

    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(mockOnSetAmount).toHaveBeenCalledWith(amount)
  })

  it("does not pass setAmount when onSetAmount is undefined", () => {
    render(<AmountInputModal {...defaultProps} />)

    expect(capturedAmountInputScreenProps.setAmount).toBeUndefined()
  })
})
