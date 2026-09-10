import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TermSheetScreen } from "@app/screens/card-screen/onboarding/investment-flow/term-sheet-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()

/** Deliberately not the $10,000 the copy used to hardcode: an amount the screen ignores
 *  would still read correctly against that one. */
const SELECTED_AMOUNT_USD = 25000

const mockRouteParams = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
  }
})

describe("TermSheetScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays equity section title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Equity in Blink")).toBeTruthy()
  })

  it("states the amount the investor chose, and what it buys", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("$25,000 Investment")).toBeTruthy()
    expect(getByText("You receive 25,000 units ~0.25% of Blink")).toBeTruthy()
  })

  /** The same page has to describe a different deal for a different choice, or it is
   *  restating a constant rather than the agreement about to be signed. */
  it("restates a different choice", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("$1,000 Investment")).toBeTruthy()
    expect(getByText("You receive 1,000 units ~0.01% of Blink")).toBeTruthy()
  })

  /** The round's valuation is the same whatever the investor puts in, so it stays put. */
  it("names the same valuation whatever the choice", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("At $10M pre-money valuation")).toBeTruthy()
  })

  it("displays proceed to sign button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Proceed to Sign")).toBeTruthy()
  })

  it("navigates to transfer invest screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Proceed to Sign")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen", {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
    })
  })
})
