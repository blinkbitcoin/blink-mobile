import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/transfer-invest-screen"
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

describe("TransferInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays transfer title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Transfer your investment")).toBeTruthy()
  })

  it("displays body1 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/You have signed the subscription agreement for 10,000 units/),
    ).toBeTruthy()
  })

  it("displays body2 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/Time to transfer the investment amount of \$10,000/)).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to top up screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTopUpScreen")
  })
})
