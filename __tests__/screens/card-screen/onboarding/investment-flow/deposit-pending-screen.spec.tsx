import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { DepositPendingScreen } from "@app/screens/card-screen/onboarding/investment-flow/deposit-pending-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
  }
})

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <DepositPendingScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return utils
}

describe("DepositPendingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()
    expect(toJSON()).toBeTruthy()
  })

  it("shows the waiting for confirmations message", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(/Waiting for your deposit to settle/)).toBeTruthy()
  })

  it("displays the okay button", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Okay")).toBeTruthy()
  })

  it("goes back when okay is pressed", async () => {
    const { getByText } = await renderScreen()
    await act(async () => {
      fireEvent.press(getByText("Okay"))
    })
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
