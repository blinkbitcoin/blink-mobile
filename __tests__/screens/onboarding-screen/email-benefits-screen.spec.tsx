import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"

import { EmailBenefitsScreen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

const route: RouteProp<OnboardingStackParamList, "emailBenefits"> = {
  key: "email-benefits",
  name: "emailBenefits",
  params: {
    onboarding: true,
    hasUsername: true,
  },
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("EmailBenefitsScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
    jest.clearAllMocks()
  })

  it("Renders localized title and descriptions", () => {
    const { getByText } = render(
      <ContextForScreen>
        <EmailBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.emailBenefits.title())).toBeTruthy()
    expect(getByText(LL.OnboardingScreen.emailBenefits.backupDescription())).toBeTruthy()
    expect(getByText(LL.OnboardingScreen.emailBenefits.supportDescription())).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.emailBenefits.securityDescription()),
    ).toBeTruthy()
  })

  it("Renders primary and secondary buttons", () => {
    const { getByText } = render(
      <ContextForScreen>
        <EmailBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.emailBenefits.primaryButton())).toBeTruthy()
    expect(getByText(LL.UpgradeAccountModal.notNow())).toBeTruthy()
  })

  it("Triggers primary action and navigates to emailRegistrationInitiate", () => {
    const mockNavigate = jest.fn()
    const mockAddListener = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      addListener: mockAddListener,
    })

    const { getByText } = render(
      <ContextForScreen>
        <EmailBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.OnboardingScreen.emailBenefits.primaryButton()))

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate", {
      onboarding: true,
      hasUsername: true,
    })
  })

  it("Triggers secondary action and navigates to supportScreen when username exists", () => {
    const mockNavigate = jest.fn()
    const mockAddListener = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      addListener: mockAddListener,
    })

    const { getByText } = render(
      <ContextForScreen>
        <EmailBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()))

    expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
      screen: "supportScreen",
    })
  })

  it("Triggers secondary action and navigates to lightningBenefits when no username", () => {
    const mockNavigate = jest.fn()
    const mockAddListener = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      addListener: mockAddListener,
    })
    const mockRoute: RouteProp<OnboardingStackParamList, "emailBenefits"> = {
      ...route,
      params: {
        ...route.params,
        hasUsername: false,
      },
    }

    const { getByText } = render(
      <ContextForScreen>
        <EmailBenefitsScreen route={mockRoute} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()))

    expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding: true },
    })
  })
})
