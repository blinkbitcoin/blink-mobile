import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AmountInput } from "@app/components/amount-input/amount-input"

const mockFormatMoneyAmount = jest.fn()
const mockGetSecondaryAmount = jest.fn()

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormatMoneyAmount,
    getSecondaryAmountIfCurrencyIsDifferent: mockGetSecondaryAmount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AmountInputButton: { tapToSetAmount: () => "Tap to set amount" },
      SendBitcoinScreen: { max: () => "Max" },
    },
  }),
}))

jest.mock("@app/config", () => ({
  APPROXIMATE_PREFIX: "~",
}))

let capturedButtonProps: Record<string, unknown> = {}

jest.mock("@app/components/amount-input/amount-input-button", () => ({
  AmountInputButton: (props: Record<string, unknown>) => {
    capturedButtonProps = props
    const RN = jest.requireActual("react-native")
    return (
      <RN.TouchableOpacity
        testID="amount-input-button"
        onPress={props.onPress as () => void}
        disabled={props.disabled as boolean}
      />
    )
  },
}))

let capturedModalProps: Record<string, unknown> = {}

jest.mock("@app/components/amount-input/amount-input-modal", () => ({
  AmountInputModal: (props: Record<string, unknown>) => {
    capturedModalProps = props
    const RN = jest.requireActual("react-native")
    return <RN.View testID="amount-input-modal" />
  },
}))

describe("AmountInput", () => {
  const mockSetAmount = jest.fn()
  const mockConvertMoneyAmount = jest.fn()

  const defaultProps = {
    walletCurrency: WalletCurrency.Btc,
    convertMoneyAmount: mockConvertMoneyAmount,
    setAmount: mockSetAmount,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedButtonProps = {}
    capturedModalProps = {}
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    mockFormatMoneyAmount.mockReturnValue("")
    mockGetSecondaryAmount.mockReturnValue(undefined)
  })

  it("renders both AmountInputButton and AmountInputModal as siblings", () => {
    const { getByTestId } = render(<AmountInput {...defaultProps} />)

    expect(getByTestId("amount-input-button")).toBeTruthy()
    expect(getByTestId("amount-input-modal")).toBeTruthy()
  })

  it("modal starts with isOpen=false", () => {
    render(<AmountInput {...defaultProps} />)

    expect(capturedModalProps.isOpen).toBe(false)
  })

  it("button press opens modal", () => {
    const { getByTestId } = render(<AmountInput {...defaultProps} />)

    fireEvent.press(getByTestId("amount-input-button"))

    expect(capturedModalProps.isOpen).toBe(true)
  })

  it("setting amount closes modal and calls setAmount", () => {
    render(<AmountInput {...defaultProps} />)

    const onSetAmount = capturedModalProps.onSetAmount as (
      amount: Record<string, unknown>,
    ) => void
    const amount = { amount: 100, currency: "BTC", currencyCode: "SAT" }
    onSetAmount(amount)

    expect(mockSetAmount).toHaveBeenCalledWith(amount)
    expect(capturedModalProps.isOpen).toBe(false)
  })

  it("close callback sets isOpen to false", () => {
    const { getByTestId } = render(<AmountInput {...defaultProps} />)

    fireEvent.press(getByTestId("amount-input-button"))
    expect(capturedModalProps.isOpen).toBe(true)

    const close = capturedModalProps.close as () => void
    act(() => {
      close()
    })

    expect(capturedModalProps.isOpen).toBe(false)
  })

  it("button disabled and no onPress when canSetAmount=false", () => {
    render(<AmountInput {...defaultProps} canSetAmount={false} />)

    expect(capturedButtonProps.disabled).toBe(true)
    expect(capturedButtonProps.onPress).toBeUndefined()
  })

  it("formats primary and secondary amounts when non-zero", () => {
    mockFormatMoneyAmount.mockReturnValue("$10.00")
    mockGetSecondaryAmount.mockReturnValue({
      amount: 1000,
      currency: WalletCurrency.Btc,
      currencyCode: "SAT",
    })

    render(
      <AmountInput
        {...defaultProps}
        unitOfAccountAmount={{
          amount: 1000,
          currency: "DisplayCurrency",
          currencyCode: "USD",
        }}
      />,
    )

    expect(capturedButtonProps.value).toBeDefined()
    expect(capturedButtonProps.secondaryValue).toBeDefined()
  })

  it("passes undefined values when amount is zero", () => {
    render(
      <AmountInput
        {...defaultProps}
        unitOfAccountAmount={{
          amount: 0,
          currency: "DisplayCurrency",
          currencyCode: "USD",
        }}
      />,
    )

    expect(capturedButtonProps.value).toBeUndefined()
    expect(capturedButtonProps.secondaryValue).toBeUndefined()
  })
})
