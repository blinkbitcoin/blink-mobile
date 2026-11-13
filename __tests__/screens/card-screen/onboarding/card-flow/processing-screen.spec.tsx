import React from "react"
import { render, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardProcessingScreen } from "@app/screens/card-screen/onboarding/card-flow/processing-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockUseDashedLineFlow = jest.fn()

jest.mock("@app/components/animations", () => ({
  useDashedLineFlow: (params: unknown) => {
    mockUseDashedLineFlow(params)
    return { animatedProps: {}, dashArray: "5 5" }
  },
}))

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardProcessingScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardProcessingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("says the application is being processed", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Processing your application")).toBeTruthy()
    expect(getByText("We will notify you once we are ready")).toBeTruthy()
  })

  it("flows the line's dashes, as long as the gaps, toward the card", async () => {
    await renderScreen()

    expect(mockUseDashedLineFlow).toHaveBeenCalledWith({
      dashLength: 89 / 18,
      gapLength: 89 / 18,
    })
  })

  it("offers no button", async () => {
    const { queryByRole } = await renderScreen()

    expect(queryByRole("button")).toBeNull()
  })
})
