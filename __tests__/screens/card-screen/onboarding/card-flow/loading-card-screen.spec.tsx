import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { LoadingCardScreen } from "@app/screens/card-screen/onboarding/card-flow/loading-card-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("@app/assets/images/monkey-typing.gif", () => "mocked-gif")

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

describe("LoadingCardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <LoadingCardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays title text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <LoadingCardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("We're working on your card")).toBeTruthy()
  })

  it("displays coding backend text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <LoadingCardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("...coding the backend")).toBeTruthy()
  })

  it("displays nice button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <LoadingCardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Nice")).toBeTruthy()
  })

  it("navigates to Primary on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <LoadingCardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Nice")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })
})
