import React from "react"
import { useNavigation, RouteProp } from "@react-navigation/native"
import { render, fireEvent } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useLevel1DailyLimit } from "@app/hooks"
import { WelcomeLevel1Screen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const route: RouteProp<OnboardingStackParamList, "welcomeLevel1"> = {
  key: "test-key",
  name: "welcomeLevel1",
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

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useLevel1DailyLimit: jest.fn(),
}))

describe("WelcomeLevel1Screen", () => {
  let LL: ReturnType<typeof i18nObject>
  const mockAddListener = jest.fn(() => jest.fn())

  beforeEach(() => {
    ;(useSettingsScreenQuery as jest.Mock).mockReturnValue(usernameMock)
    ;(useLevel1DailyLimit as jest.Mock).mockReturnValue({ limit: "999" })
    ;(useNavigation as jest.Mock).mockReturnValue({
      addListener: mockAddListener,
    })
    mockAddListener.mockClear()

    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders localized title and description lines", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.OnboardingScreen.welcomeLevel1.title())).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.welcomeLevel1.receiveBitcoinDescription()),
    ).toBeTruthy()
    // "999" is both the shared-mock backend value and the audited fallback
    expect(
      getByText(
        LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription({ limit: "999" }),
      ),
    ).toBeTruthy()
    expect(getByText(LL.OnboardingScreen.welcomeLevel1.onchainDescription())).toBeTruthy()
  })

  it("Renders the daily limit provided by the backend hook", () => {
    ;(useLevel1DailyLimit as jest.Mock).mockReturnValue({ limit: "1,500" })

    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )

    expect(
      getByText(
        LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription({ limit: "1,500" }),
      ),
    ).toBeTruthy()
  })

  it("Triggers primary action button with label", async () => {
    const mockReplace = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      replace: mockReplace,
      addListener: mockAddListener,
      navigate: mockReplace,
    })

    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()

    const primaryBtn = getByText(LL.common.next())
    fireEvent.press(primaryBtn)
    expect(mockReplace).toHaveBeenCalledWith("onboarding", {
      screen: "emailBenefits",
      params: {
        onboarding: true,
        hasUsername: true,
      },
    })
  })
})
