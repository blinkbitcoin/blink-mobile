import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SwitchAccountComponent } from "@app/screens/settings-screen/settings/swiitch-account.stories"
import { GetUsernamesDocument, SettingsScreenDocument } from "@app/graphql/generated"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import mocks from "@app/graphql/mocks"
import { ContextForScreen } from "../helper"

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getSessionTokens: jest.fn().mockResolvedValue(["mock-token-1"]),
    saveSessionToken: jest.fn(),
    removeTokenFromSession: jest.fn(),
  },
}))

const mocksWithUsername = [
  ...mocks,
  {
    request: {
      query: GetUsernamesDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          username: "test1",
          phone: null,
          __typename: "User",
        },
      },
    },
  },
]

describe("Settings", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders switch account row", async () => {
    render(
      <ContextForScreen>
        <SwitchAccountComponent mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    expect(screen.getByText(LL.AccountScreen.switchAccount())).toBeTruthy()
  })

  it("SwitchAccount expands and shows loading, then user profiles", async () => {
    render(
      <ContextForScreen>
        <SwitchAccountComponent mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    const switchBtn = screen.getByText(LL.AccountScreen.switchAccount())
    fireEvent.press(switchBtn)

    // The spinner should be displayed
    expect(screen.getByTestId("loading-indicator")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText("test1")).toBeTruthy()
    })

    expect(KeyStoreWrapper.getSessionTokens).toHaveBeenCalledTimes(1)
    await expect(KeyStoreWrapper.getSessionTokens()).resolves.toEqual(["mock-token-1"])
  })

  it("renders add account button when profiles are loaded", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SwitchAccountComponent mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.AccountScreen.switchAccount()))

    await waitFor(() => {
      expect(getByText(LL.ProfileScreen.addAccount())).toBeTruthy()
    })
  })

  it("shows error when GraphQL query fails", async () => {
    const mockWithError = [
      {
        request: {
          query: SettingsScreenDocument,
        },
        error: new Error("GraphQL error"),
      },
    ]

    const { getByText } = render(
      <ContextForScreen>
        <SwitchAccountComponent mock={mockWithError} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.AccountScreen.switchAccount()))

    await waitFor(() => {
      expect(getByText(LL.ProfileScreen.error())).toBeTruthy()
      expect(getByText("reload")).toBeTruthy()
    })
  })
})
