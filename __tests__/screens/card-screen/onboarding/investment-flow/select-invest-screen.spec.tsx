import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { SelectInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/select-invest-screen"
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

describe("SelectInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays the title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("How much would you like to invest?")).toBeTruthy()
  })

  it("displays credit limit options", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/\$1,000/)).toBeTruthy()
    expect(getByText(/\$2,500/)).toBeTruthy()
    expect(getByText(/\$5,000/)).toBeTruthy()
  })

  it("button is disabled initially", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Next")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("selects an option on press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const option = getByText(/\$1,000/)
    await act(async () => {
      fireEvent.press(option)
    })

    expect(option).toBeTruthy()
  })

  it("navigates to term sheet screen when option selected and button pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SelectInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const option = getByText(/\$1,000/)
    await act(async () => {
      fireEvent.press(option)
    })

    const button = getByText("Next")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingTermSheetScreen")
  })
})
