import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SwitchAccountComponent } from "@app/screens/settings-screen/settings/swiitch-account.stories"
import { GetUsernamesDocument } from "@app/graphql/generated"
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

    expect(KeyStoreWrapper.getSessionTokens).toHaveBeenCalled()
  })
})
