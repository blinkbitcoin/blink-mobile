import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  AmountInputScreen,
  ConvertInputType,
} from "@app/components/transfer-amount-input/amount-input-screen"

import { ContextForScreen } from "../screens/helper"

/**
 * The conversion keypad with its real UI and keyboard: a held backspace repeats here as on
 * every other amount keypad, against the amount as it is on each tick.
 */

const mockOnAmountChange = jest.fn()
const mockConvertMoneyAmount = jest.fn()

jest.mock("@app/hooks/use-display-currency", () => {
  const currencyInfo = {
    BTC: {
      symbol: "",
      minorUnitToMajorUnitOffset: 0,
      showFractionDigits: false,
      currencyCode: "SAT",
    },
    USD: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
    DisplayCurrency: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
  }
  return {
    useDisplayCurrency: () => ({
      currencyInfo,
      formatMoneyAmount: () => "$0.00",
      zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
    }),
  }
})

jest.mock("@app/hooks/use-debounce", () => ({
  useDebouncedEffect: (callback: () => void) => {
    React.useEffect(() => {
      callback()
    }, [callback])
  },
}))

const inputValues = {
  formattedAmount: "",
  fromInput: {
    id: ConvertInputType.FROM,
    currency: "BTC" as const,
    formattedAmount: "",
    isFocused: false,
    amount: toBtcMoneyAmount(0),
  },
  toInput: {
    id: ConvertInputType.TO,
    currency: "USD" as const,
    formattedAmount: "",
    isFocused: false,
    amount: toUsdMoneyAmount(0),
  },
  currencyInput: {
    id: ConvertInputType.CURRENCY,
    currency: "DisplayCurrency" as const,
    formattedAmount: "",
    isFocused: false,
    amount: { amount: 0, currency: "DisplayCurrency" as const, currencyCode: "USD" },
  },
}

/** The amount the screen hands back after each key, in cents of the display currency. */
const typed = () => mockOnAmountChange.mock.lastCall?.[0].amount

describe("conversion keypad held backspace", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("deletes once every 300 ms and stops at an empty amount", () => {
    render(
      <ContextForScreen>
        <AmountInputScreen
          inputValues={inputValues}
          onAmountChange={mockOnAmountChange}
          convertMoneyAmount={mockConvertMoneyAmount}
          onSetFormattedAmount={jest.fn()}
          focusedInput={null}
        />
      </ContextForScreen>,
    )
    ;["1", "2", "3"].forEach((key) => fireEvent.press(screen.getByTestId(`Key ${key}`)))
    expect(typed()).toBe(12300)

    fireEvent(screen.getByTestId("Key ⌫"), "pressIn")
    const seen = [1, 2, 3].map(() => {
      act(() => {
        jest.advanceTimersByTime(300)
      })
      return typed()
    })
    expect(seen).toEqual([1200, 100, 0])

    /** At an empty amount backspace disables, which ends the repeat: a digit typed while
     *  the key is still held survives the ticks that would have followed. */
    act(() => {
      jest.advanceTimersByTime(300)
    })
    fireEvent.press(screen.getByTestId("Key 7"))
    act(() => {
      jest.advanceTimersByTime(900)
    })
    expect(typed()).toBe(700)
  })
})
