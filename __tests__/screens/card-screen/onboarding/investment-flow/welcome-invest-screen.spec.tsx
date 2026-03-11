import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WelcomeInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/welcome-invest-screen"
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

describe("WelcomeInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays welcome title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Welcome to become part of Blink")).toBeTruthy()
  })

  it("displays body1 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/Before we raise more funds from professional investors/),
    ).toBeTruthy()
  })

  it("displays body2 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        "This is a personal invitation. Please do not forward or share publicly.",
      ),
    ).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to company valuation screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingCompanyValuationScreen")
  })
})
