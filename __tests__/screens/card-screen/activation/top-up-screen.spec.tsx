import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import { CardActivationStep } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CardTopUpScreen } from "@app/screens/card-screen/activation/top-up-screen"

import { ContextForScreen } from "../../helper"

const mockComplete = jest.fn()
const mockUseCardActivation = jest.fn()
jest.mock("@app/hooks/use-card-activation", () => ({
  useCardActivation: (options: Record<string, unknown>) => mockUseCardActivation(options),
}))

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardTopUpScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardTopUpScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseCardActivation.mockReturnValue({ complete: mockComplete, isCompleting: false })
  })

  it("stands for the top-up step of the activation", async () => {
    await renderScreen()

    expect(mockUseCardActivation).toHaveBeenCalledWith({
      step: CardActivationStep.TopUp,
    })
  })

  it("offers adding funds now or later", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Top-up your card")).toBeTruthy()
    expect(getByText("Add funds now, or later.")).toBeTruthy()
  })

  it("shows both ways to add funds as unavailable", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("From your Bitcoin or Dollar Balance")).toBeDisabled()
    expect(getByText("Deposit to your Card Balance")).toBeDisabled()
  })

  it("keeps Top-up now off, since no way can be chosen", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Top-up now")).toBeDisabled()
  })

  it("completes the activation when the member skips the top-up", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Skip top-up"))
    })

    expect(mockComplete).toHaveBeenCalledTimes(1)
  })

  it("shows the completion running instead of the skip", async () => {
    mockUseCardActivation.mockReturnValue({ complete: mockComplete, isCompleting: true })
    const { queryByText } = await renderScreen()

    expect(queryByText("Skip top-up")).toBeNull()
  })
})
