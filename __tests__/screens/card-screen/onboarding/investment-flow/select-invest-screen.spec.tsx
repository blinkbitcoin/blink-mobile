import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { SelectInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/select-invest-screen"
import { ContextForScreen, findPressableParent } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

describe("SelectInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays the title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("How much would you like to invest?")).toBeTruthy()
  })

  it("displays the investment options", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/\$1,000/)).toBeTruthy()
    expect(getByText(/\$2,500/)).toBeTruthy()
    expect(getByText(/\$5,000/)).toBeTruthy()
  })

  /** The share beside each amount is derived from the valuation, the way the term sheet
   *  derives it, so the two screens cannot describe different deals. */
  it("states beside each amount the share of the company it buys", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/\$1,000 for ~0\.01%/)).toBeTruthy()
    expect(getByText(/\$10,000 for ~0\.1%/)).toBeTruthy()
    expect(getByText(/\$100,000 for ~1%/)).toBeTruthy()
  })

  it("button is disabled initially", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Next")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The chosen row says so, and only one row at a time. */
  it("marks the pressed option as selected, and moves the mark with the next press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})
    const first = findPressableParent(getByText(/\$1,000/))
    const second = findPressableParent(getByText(/\$2,500/))
    expect(first.props.accessibilityState.selected).toBe(false)

    await act(async () => {
      fireEvent.press(first)
    })
    expect(first.props.accessibilityState.selected).toBe(true)
    expect(second.props.accessibilityState.selected).toBe(false)

    await act(async () => {
      fireEvent.press(second)
    })
    expect(first.props.accessibilityState.selected).toBe(false)
    expect(second.props.accessibilityState.selected).toBe(true)
  })

  it("navigates to term sheet screen when option selected and button pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const option = getByText(/\$1,000/)
    await act(async () => {
      fireEvent.press(option)
    })

    const button = getByText("Next")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTermSheetScreen", {
      selectedAmountUsd: 1000,
    })
  })
})
