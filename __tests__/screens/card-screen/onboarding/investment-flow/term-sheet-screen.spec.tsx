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

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

describe("TermSheetScreen", () => {
  beforeEach(() => {
    loadLocale("en")
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

  it("displays equity features", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TermSheetScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("$10,000 Investment")).toBeTruthy()
    expect(getByText("At $10M pre-money valuation")).toBeTruthy()
    expect(getByText("You receive 10,000 units ~0.1% of Blink")).toBeTruthy()
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

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen")
  })
})
