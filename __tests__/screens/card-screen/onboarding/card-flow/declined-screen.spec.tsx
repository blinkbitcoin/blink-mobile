import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDeclinedScreen } from "@app/screens/card-screen/onboarding/card-flow/declined-screen"
import { ContextForScreen } from "../../../helper"

const mockPopTo = jest.fn()
const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      popTo: mockPopTo,
      navigate: mockNavigate,
    }),
  }
})

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardDeclinedScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardDeclinedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("says the application was not approved and who follows up", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("We couldn't approve your card application")).toBeTruthy()
    expect(getByText("Your account manager will be in touch.")).toBeTruthy()
  })

  it("marks the refusal with the declined icon", async () => {
    const { getByTestId } = await renderScreen()

    expect(getByTestId("icon-declined")).toBeTruthy()
  })

  it("goes back to the Home under it on Close, rather than stacking another", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Close"))
    })

    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
