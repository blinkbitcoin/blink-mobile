import React from "react"
import { act, render, screen } from "@testing-library/react-native"
import { SettingsScreenDocument } from "@app/graphql/generated"
import { LoggedInWithUsername } from "@app/screens/settings-screen/settings-screen.stories"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import mocks from "@app/graphql/mocks"
import { ContextForScreen } from "../helper"

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
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
  beforeEach(() => {
    loadLocale("en")
  })

  it("Renders user info", async () => {
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

    const elements = screen.getAllByText("test1@blink.sv")
    expect(elements.length).toBeGreaterThan(0)
  })
})
