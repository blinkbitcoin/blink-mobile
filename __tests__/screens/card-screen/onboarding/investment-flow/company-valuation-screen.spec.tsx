import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CompanyValuationScreen } from "@app/screens/card-screen/onboarding/investment-flow/company-valuation-screen"
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

describe("CompanyValuationScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays company valuation title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Company valuation")).toBeTruthy()
  })

  it("displays body1 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/pre-money valuation of Blink is \$10 million/)).toBeTruthy()
  })

  it("displays body2 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/we see long-term mutual benefits in partnering with our superusers/),
    ).toBeTruthy()
  })

  it("displays got it button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Got it")).toBeTruthy()
  })

  it("navigates to select invest screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CompanyValuationScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Got it")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingSelectInvestScreen")
  })
})
