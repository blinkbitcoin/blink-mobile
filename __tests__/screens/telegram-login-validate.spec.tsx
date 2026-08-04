import React from "react"
import { render, screen, waitFor } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { MockedProvider } from "@apollo/client/testing"

import { createCache } from "@app/graphql/cache"
import { TelegramLoginScreen } from "@app/screens/telegram-login-screen/telegram-login-validate"
import { PhoneValidationStackParamList } from "@app/navigation/stack-param-lists"
import {
  useTelegramLogin,
  ErrorType,
} from "@app/screens/telegram-login-screen/telegram-auth"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "./helper"

// Mock useTelegramLogin
jest.mock("@app/screens/telegram-login-screen/telegram-auth", () => {
  const actual = jest.requireActual("@app/screens/telegram-login-screen/telegram-auth")
  return {
    ...actual,
    useTelegramLogin: jest.fn(),
  }
})

const mockUseTelegramLogin = useTelegramLogin as jest.Mock

const mockRoute: RouteProp<PhoneValidationStackParamList, "telegramLoginValidate"> = {
  key: "telegram-login",
  name: "telegramLoginValidate",
  params: {
    phone: "+50378662557",
    type: "Login",
  },
}

const TelegramLogin = ({
  mockRoute,
}: {
  mockRoute: RouteProp<PhoneValidationStackParamList, "telegramLoginValidate">
}) => (
  <MockedProvider cache={createCache()}>
    <TelegramLoginScreen route={mockRoute} />
  </MockedProvider>
)

describe("Telegram Login Screen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")

    // Default mock
    mockUseTelegramLogin.mockReturnValue({
      loading: false,
      error: null,
      isPollingForAuth: false,
      handleTelegramLogin: jest.fn(),
    })
  })

  it("renders login button", async () => {
    render(
      <ContextForScreen>
        <TelegramLogin mockRoute={mockRoute} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(LL.TelegramValidationScreen.loginWithTelegram()),
      ).toBeTruthy()
    })
  })

  it("renders screen title and description", async () => {
    render(
      <ContextForScreen>
        <TelegramLogin mockRoute={mockRoute} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByText(LL.TelegramValidationScreen.text())).toBeTruthy()
      expect(screen.getByText(LL.TelegramValidationScreen.description())).toBeTruthy()
    })
  })

  it("renders GaloyInfo while polling", async () => {
    mockUseTelegramLogin.mockReturnValueOnce({
      loading: false,
      error: null,
      isPollingForAuth: true,
      handleTelegramLogin: jest.fn(),
    })

    render(
      <ContextForScreen>
        <TelegramLogin mockRoute={mockRoute} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(LL.TelegramValidationScreen.waitingForAuthorization()),
      ).toBeTruthy()
    })
  })

  it("renders GaloyErrorBox when error exists", async () => {
    mockUseTelegramLogin.mockReturnValueOnce({
      loading: false,
      error: ErrorType.OpenAppError,
      isPollingForAuth: false,
      handleTelegramLogin: jest.fn(),
    })

    render(
      <ContextForScreen>
        <TelegramLogin mockRoute={mockRoute} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(LL.TelegramValidationScreen.errorOpenAppError()),
      ).toBeTruthy()
    })
  })
})
