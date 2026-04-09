import React from "react"
import { render, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferringFundsScreen } from "@app/screens/account-migration/to-non-custodial/transferring-funds-screen"
import { ContextForScreen } from "../../helper"

loadLocale("en")

jest.mock("@app/components/status-screen-layout", () => ({
  StatusScreenLayout: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID="status-layout">{children}</View>
  },
}))

describe("TransferringFundsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders transferring funds message", () => {
    render(
      <ContextForScreen>
        <TransferringFundsScreen />
      </ContextForScreen>,
    )

    expect(
      screen.getByText("Transferring your funds. It should be done in a few seconds."),
    ).toBeTruthy()
  })

  it("renders status layout", () => {
    render(
      <ContextForScreen>
        <TransferringFundsScreen />
      </ContextForScreen>,
    )

    expect(screen.getByTestId("status-layout")).toBeTruthy()
  })
})
