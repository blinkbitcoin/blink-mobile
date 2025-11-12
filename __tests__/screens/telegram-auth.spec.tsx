/* eslint-disable camelcase */
import React from "react"
import axios from "axios"
import { Linking } from "react-native"
import { renderHook, act } from "@testing-library/react-hooks"

import {
  useTelegramLogin,
  ErrorType,
} from "@app/screens/telegram-login-screen/telegram-auth"
import { formatPublicKey } from "@app/utils/format-public-key"
import { BLINK_DEEP_LINK_PREFIX, TELEGRAM_CALLBACK_PATH } from "@app/config"

import { ContextForScreen } from "./helper"

// Mocks
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
    }),
    useFocusEffect: (fn: () => void) => fn(),
  }
})

jest.mock("@react-native-firebase/analytics", () => () => ({
  logLogin: jest.fn(),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        authUrl: "https://api.blink.sv",
      },
    },
  }),
  useTokenManager: () => ({
    saveToken: jest.fn(),
    saveTokenAndInstance: jest.fn(),
  }),
  useSaveSessionProfile: () => ({
    saveProfile: jest.fn(),
  }),
}))

jest.mock("axios")
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn(),
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}))

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ContextForScreen>{children}</ContextForScreen>
)

describe("useTelegramLogin", () => {
  const mockPhone = "+50376543210"
  const mockData = {
    bot_id: "1111111111",
    scope: { data: ["phone_number"], v: 1 },
    public_key: "mocked_public_key",
    nonce: "mocked_nonce",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should call getTelegramPassportRequestParams and open a URL", async () => {
    ;(axios.post as jest.Mock).mockResolvedValueOnce({ data: mockData })
    ;(Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true)
    ;(Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useTelegramLogin(mockPhone), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleTelegramLogin()
    })

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.blink.sv/auth/telegram-passport/request-params",
      { phone: mockPhone },
    )

    expect(Linking.canOpenURL).toHaveBeenCalled()
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("tg://passport"))
    expect(result.current.error).toBeNull()
  })

  it("should handle fallback link if Telegram is not installed", async () => {
    ;(axios.post as jest.Mock).mockResolvedValueOnce({ data: mockData })
    ;(Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false)

    const { result } = renderHook(() => useTelegramLogin(mockPhone), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleTelegramLogin()
    })

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining("https://telegram.me/telegrampassport"),
    )
  })

  it("should handle error from backend", async () => {
    ;(axios.post as jest.Mock).mockRejectedValueOnce({
      response: { data: {} },
    })

    const { result } = renderHook(() => useTelegramLogin(mockPhone), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleTelegramLogin()
    })

    expect(result.current.error).toBe(ErrorType.FetchParamsError)
  })

  it("should handle general errors", async () => {
    ;(axios.post as jest.Mock).mockRejectedValueOnce(new Error("network failed"))

    const { result } = renderHook(() => useTelegramLogin(mockPhone), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleTelegramLogin()
    })

    expect(result.current.error).toBe(ErrorType.FetchParamsError)
  })

  it("should generate correct deepLink", async () => {
    ;(axios.post as jest.Mock).mockResolvedValueOnce({ data: mockData })
    ;(Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true)

    const { result } = renderHook(() => useTelegramLogin(mockPhone), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleTelegramLogin()
    })

    const encodedScope = encodeURIComponent(JSON.stringify(mockData.scope))
    const encodedPublicKey = encodeURIComponent(formatPublicKey(mockData.public_key))
    const callback = encodeURIComponent(
      `${BLINK_DEEP_LINK_PREFIX}/${TELEGRAM_CALLBACK_PATH}`,
    )

    const expectedDeepLink = `tg://passport?bot_id=${mockData.bot_id}&scope=${encodedScope}&public_key=${encodedPublicKey}&nonce=${mockData.nonce}&callback_url=${callback}`

    expect(Linking.openURL).toHaveBeenCalledWith(expectedDeepLink)
  })
})
