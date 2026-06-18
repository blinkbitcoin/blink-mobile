import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardProcessingScreen } from "@app/screens/card-screen/onboarding/card-flow/processing-screen"
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

describe("CardProcessingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardProcessingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays processing title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardProcessingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Processing your application")).toBeTruthy()
  })

  it("displays subtitle with wait time", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardProcessingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Estimated wait time: 24h")).toBeTruthy()
  })

  it("displays close button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardProcessingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Close")).toBeTruthy()
  })

  it("navigates to Primary on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardProcessingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Close")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })
})
