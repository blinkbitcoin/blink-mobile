import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { InsufficientBalanceScreen } from "@app/screens/card-screen/onboarding/investment-flow/insufficient-balance-screen"
import {
  MOCK_BITCOIN_BALANCE,
  MOCK_INVESTMENT_AMOUNT,
  MOCK_INVESTMENT_SHORTFALL,
} from "@app/screens/card-screen/onboarding/onboarding-mock-data"
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

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <InsufficientBalanceScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return utils
}

describe("InsufficientBalanceScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()
    expect(toJSON()).toBeTruthy()
  })

  it("displays the insufficient balance title", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("shows the current Bitcoin balance", async () => {
    const { getByText } = await renderScreen()
    expect(
      getByText(`You only have ${MOCK_BITCOIN_BALANCE} in your Bitcoin account.`),
    ).toBeTruthy()
  })

  it("shows the shortfall and the investment amount", async () => {
    const { getByText } = await renderScreen()
    expect(
      getByText(
        `Deposit more than ${MOCK_INVESTMENT_SHORTFALL} to your account to reach the investment amount of ${MOCK_INVESTMENT_AMOUNT}.`,
      ),
    ).toBeTruthy()
  })

  it("explains the funds can be in either account", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(/in either of your accounts/)).toBeTruthy()
  })

  it("displays the deposit button", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Deposit")).toBeTruthy()
  })

  it("navigates to the top up screen when deposit is pressed", async () => {
    const { getByText } = await renderScreen()
    await act(async () => {
      fireEvent.press(getByText("Deposit"))
    })
    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTopUpScreen")
  })
})
