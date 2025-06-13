import React from "react"
import { act, render, screen } from "@testing-library/react-native"
import { SettingsScreenDocument, useBetaQuery } from "@app/graphql/generated"
import { LoggedInWithUsername } from "@app/screens/settings-screen/settings-screen.stories"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import mocks from "@app/graphql/mocks"
import { ContextForScreen } from "../helper"

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useBetaQuery: jest.fn(() => ({ data: { beta: true } })),
}))

const mocksWithUsername = [
  ...mocks,
  {
    request: {
      query: SettingsScreenDocument,
    },
    result: {
      data: {
        me: {
          id: "70df9822-efe0-419c-b864-c9efa99872ea",
          phone: "+50365055539",
          username: "test1",
          language: "en",
          defaultAccount: {
            id: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            displayCurrency: "EN",
            defaultWalletId: "84b26b88-89b0-5c6f-9d3d-fbead08f79d8",
            __typename: "ConsumerAccount",
          },
          __typename: "User",
        },
      },
    },
  },
]

describe("Settings Screen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders switch account component when beta is enabled", async () => {
    ;(useBetaQuery as jest.Mock).mockReturnValue({ data: { beta: true } })

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByTestId("Switch Account")).toBeTruthy()
    expect(screen.getByTestId("Switch Account-right")).toBeTruthy()
    expect(screen.getByText(LL.AccountScreen.switchAccount())).toBeTruthy()
  })

  it("Renders switch account component when beta is disabled", async () => {
    ;(useBetaQuery as jest.Mock).mockReturnValue({ data: { beta: false } })

    render(
      <ContextForScreen>
        <LoggedInWithUsername mock={mocksWithUsername} />
      </ContextForScreen>,
    )

    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10)
        }),
    )

    expect(screen.getByTestId("Switch Account")).toBeTruthy()
    expect(screen.getByTestId("Switch Account-right")).toBeTruthy()
    expect(screen.getByText(LL.AccountScreen.switchAccount())).toBeTruthy()
  })
})
