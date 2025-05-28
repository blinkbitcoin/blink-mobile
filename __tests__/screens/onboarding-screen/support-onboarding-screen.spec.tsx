import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { useNavigation } from "@react-navigation/native"
import { Linking } from "react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SupportOnboardingScreen } from "@app/screens/onboarding-screen"
import { CONTACT_EMAIL_ADDRESS } from "@app/config"

import { ContextForScreen } from "../helper"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn(),
  canOpenURL: jest.fn(),
}))

describe("SupportOnboardingScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders title and description", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.supportScreen.title())).toBeTruthy()
    expect(getByText(LL.OnboardingScreen.supportScreen.description())).toBeTruthy()
    expect(getByText(CONTACT_EMAIL_ADDRESS)).toBeTruthy()
  })

  it("renders icon with correct testID", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <SupportOnboardingScreen />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-support")).toBeTruthy()
  })

  it("calls navigation.replace when primary action is pressed", () => {
    const mockReplace = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ replace: mockReplace })

    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.OnboardingScreen.supportScreen.primaryButton()))
    expect(mockReplace).toHaveBeenCalledWith("Primary")
  })

  it("calls Linking.openURL when secondary action is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.OnboardingScreen.supportScreen.secondaryButton()))
    expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL_ADDRESS}`)
  })

  it("calls Linking.openURL when email link is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(CONTACT_EMAIL_ADDRESS))
    expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL_ADDRESS}`)
  })
})
