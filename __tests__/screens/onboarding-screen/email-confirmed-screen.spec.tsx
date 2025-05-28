import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"

import { EmailConfirmedScreen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

const route: RouteProp<OnboardingStackParamList, "emailConfirmed"> = {
  key: "email-confirmed-key",
  name: "emailConfirmed",
  params: {
    onboarding: true,
  },
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("EmailConfirmedScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders title and descriptions", () => {
    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.emailConfirmed.title())).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.emailBenefits.backupDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.emailBenefits.supportDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.emailBenefits.securityDescription()}`),
    ).toBeTruthy()
  })

  it("Displays primary action button", () => {
    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.next())).toBeTruthy()
  })

  it("Triggers navigation to lightningBenefits when primary button is pressed", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate })

    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding: true },
    })
  })

  it("Passes correct onboarding param", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate })

    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.next()))

    const lastCall = mockNavigate.mock.calls[0]
    expect(lastCall[1]?.params?.onboarding).toBe(true)
  })

  it("Renders icon when iconName is provided", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-email-check")).toBeTruthy()
  })
})
