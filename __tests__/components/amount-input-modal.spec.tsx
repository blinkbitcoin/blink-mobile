import React from "react"
import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AmountInputModal } from "@app/components/amount-input/amount-input-modal"

const mockPresent = jest.fn()
const mockDismiss = jest.fn()
let capturedOnDismiss: (() => void) | undefined

jest.mock("@gorhom/bottom-sheet", () => {
  const RN = jest.requireActual("react-native")
  const ReactMod = jest.requireActual("react")

  const BottomSheetModal = ReactMod.forwardRef(
    (
      {
        children,
        onDismiss,
      }: {
        children: React.ReactNode
        onDismiss?: () => void
      },
      ref: React.Ref<{ present: () => void; dismiss: () => void }>,
    ) => {
      capturedOnDismiss = onDismiss
      ReactMod.useImperativeHandle(ref, () => ({
        present: mockPresent,
        dismiss: mockDismiss,
      }))
      return <RN.View testID="bottom-sheet-modal">{children}</RN.View>
    },
  )

  return {
    BottomSheetModal,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => (
      <RN.View testID="bottom-sheet-view">{children}</RN.View>
    ),
    BottomSheetBackdrop: () => <RN.View testID="backdrop" />,
  }
})

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock("@rn-vui/themed", () => ({
  makeStyles: () => () => ({ handleIndicator: {}, sheetBackground: {} }),
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
    isOpen: false,
    close: mockClose,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedAmountInputScreenProps = {}
    capturedOnDismiss = undefined
  })

  it("renders BottomSheetModal", () => {
    const { getByTestId } = render(<AmountInputModal {...defaultProps} />)

    expect(getByTestId("bottom-sheet-modal")).toBeTruthy()
  })

  it("renders AmountInputScreen inside sheet", () => {
    const { getByTestId } = render(<AmountInputModal {...defaultProps} />)

    expect(getByTestId("amount-input-screen")).toBeTruthy()
  })

  it("calls close on dismiss", () => {
    render(<AmountInputModal {...defaultProps} />)

    capturedOnDismiss?.()
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
      <AmountInputModal {...defaultProps} maxAmount={maxAmount} minAmount={minAmount} />,
    )

    expect(capturedAmountInputScreenProps.maxAmount).toBe(maxAmount)
    expect(capturedAmountInputScreenProps.minAmount).toBe(minAmount)
  })

  it("wraps onSetAmount to also dismiss the sheet", () => {
    render(<AmountInputModal {...defaultProps} onSetAmount={mockOnSetAmount} />)

    const setAmountFn = capturedAmountInputScreenProps.setAmount as (
      amount: Record<string, unknown>,
    ) => void
    expect(setAmountFn).toBeDefined()

    const amount = { amount: 100, currency: "BTC", currencyCode: "SAT" }
    setAmountFn(amount)

    expect(mockOnSetAmount).toHaveBeenCalledWith(amount)
    expect(mockDismiss).toHaveBeenCalled()
  })

  it("does not pass setAmount when onSetAmount is undefined", () => {
    render(<AmountInputModal {...defaultProps} />)

    expect(capturedAmountInputScreenProps.setAmount).toBeUndefined()
  })
})
