import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"

import { EmailConfirmedScreen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../helper"

const route: RouteProp<OnboardingStackParamList, "emailConfirmed"> = {
  key: "email-confirmed-key",
  name: "emailConfirmed",
  params: {
    onboarding: true,
  },
}

const usernameMock = {
  loading: false,
  data: {
    me: {
      username: "userexample",
    },
  },
}

const noUsernameMock = {
  loading: false,
  data: {
    me: {
      username: null,
    },
  },
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: jest.fn(),
}))

describe("EmailConfirmedScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    ;(useSettingsScreenQuery as jest.Mock).mockReturnValue(usernameMock)

    loadLocale("en")
    LL = i18nObject("en")
    jest.clearAllMocks()
  })

  it("renders title and descriptions", () => {
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

  it("renders primary button", () => {
    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.next())).toBeTruthy()
  })

  it("navigates to supportScreen if username exists", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate })

    const { getByText } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.next()))

    expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
      screen: "supportScreen",
    })
  })

  it("navigates to lightningBenefits if username is missing", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate })
    ;(useSettingsScreenQuery as jest.Mock).mockReturnValue(noUsernameMock)

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

  it("renders the icon if iconName is passed", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <EmailConfirmedScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-email-check")).toBeTruthy()
  })
})
