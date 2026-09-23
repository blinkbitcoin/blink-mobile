import React from "react"
import { Share } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Clipboard from "@react-native-clipboard/clipboard"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ApiKeyCreateScreen } from "@app/screens/settings-screen/api/api-key-create-screen"
import { enableScreenSecurity } from "@app/utils/screen-security"

import { ContextForScreen } from "./helper"
import { flushEffects } from "../helpers/flush-effects"

const API_KEY_SECRET = "blink_S3CR3TS3CR3TS3CR3T"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
    View: RNView,
  }
})

const apiKeyCreateMock = jest.fn(() =>
  Promise.resolve({
    data: {
      apiKeyCreate: {
        apiKey: {
          __typename: "ApiKey" as const,
          id: "key-1",
          name: "CI bot",
          createdAt: 1700000000,
          revoked: false,
          expired: false,
          lastUsedAt: null,
          expiresAt: null,
          scopes: ["READ"],
          readOnly: false,
        },
        apiKeySecret: API_KEY_SECRET,
      },
    },
  }),
)

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useApiKeyCreateMutation: () => [apiKeyCreateMock, { loading: false }],
  }
})

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve("")),
}))

jest.mock("@app/utils/screen-security", () => ({
  enableScreenSecurity: jest.fn(() => Promise.resolve()),
  disableScreenSecurity: jest.fn(() => Promise.resolve()),
}))

loadLocale("en")
const LL = i18nObject("en")

const renderScreen = () =>
  render(
    <ContextForScreen>
      <ApiKeyCreateScreen />
    </ContextForScreen>,
  )

const typeName = (name: string) =>
  fireEvent.changeText(
    screen.getByPlaceholderText(LL.ApiScreen.keyNamePlaceholder()),
    name,
  )

const pressCreate = () => fireEvent.press(screen.getByTestId(LL.ApiScreen.createKey()))

describe("ApiKeyCreateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not submit while the name is empty", async () => {
    renderScreen()
    await flushEffects()

    pressCreate()
    expect(apiKeyCreateMock).not.toHaveBeenCalled()
  })

  it("does not submit when both scopes are toggled off", async () => {
    renderScreen()
    await flushEffects()

    typeName("CI bot")
    fireEvent(screen.getByTestId("scope-read-switch"), "pressIn")
    fireEvent(screen.getByTestId("scope-receive-switch"), "pressIn")

    pressCreate()
    expect(apiKeyCreateMock).not.toHaveBeenCalled()
  })

  it("creates a key with the selected scopes and expiry", async () => {
    renderScreen()

    typeName("CI bot")
    fireEvent(screen.getByTestId("scope-receive-switch"), "pressIn")
    fireEvent.press(screen.getByTestId(LL.ApiScreen.expiryNever()))

    pressCreate()

    await waitFor(() =>
      expect(apiKeyCreateMock).toHaveBeenCalledWith({
        variables: {
          input: { name: "CI bot", scopes: ["READ"], expireInDays: null },
        },
      }),
    )
  })

  it("defaults to both scopes and 90 days expiry", async () => {
    renderScreen()

    typeName("CI bot")
    pressCreate()

    await waitFor(() =>
      expect(apiKeyCreateMock).toHaveBeenCalledWith({
        variables: {
          input: {
            name: "CI bot",
            scopes: ["READ", "RECEIVE"],
            expireInDays: 90,
          },
        },
      }),
    )
  })

  it("reveals the one-time secret with copy, share and screen security", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: Share.sharedAction })

    renderScreen()

    typeName("CI bot")
    pressCreate()

    expect(await screen.findByText(API_KEY_SECRET)).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.secretWarning())).toBeTruthy()
    expect(enableScreenSecurity).toHaveBeenCalled()

    fireEvent.press(screen.getByTestId("api-key-secret"))
    expect(Clipboard.setString).toHaveBeenCalledWith(API_KEY_SECRET)

    fireEvent.press(screen.getByTestId(LL.common.share()))
    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith({ message: API_KEY_SECRET }),
    )
  })

  it("shows an error and stays on the form when the mutation fails", async () => {
    apiKeyCreateMock.mockRejectedValueOnce(new Error("boom"))

    renderScreen()

    typeName("CI bot")
    pressCreate()

    expect(await screen.findByText(LL.ApiScreen.createError())).toBeTruthy()
    expect(screen.queryByText(LL.ApiScreen.secretWarning())).toBeNull()
  })

  it("shows an error when the response is missing the secret", async () => {
    apiKeyCreateMock.mockResolvedValueOnce({
      data: {
        apiKeyCreate: {
          apiKey: {
            __typename: "ApiKey" as const,
            id: "key-2",
            name: "CI bot",
            createdAt: 1700000000,
            revoked: false,
            expired: false,
            lastUsedAt: null,
            expiresAt: null,
            scopes: ["READ"],
            readOnly: false,
          },
          apiKeySecret: "",
        },
      },
    })

    renderScreen()

    typeName("CI bot")
    pressCreate()

    expect(await screen.findByText(LL.ApiScreen.createError())).toBeTruthy()
    expect(screen.queryByText(LL.ApiScreen.secretWarning())).toBeNull()
  })
})
