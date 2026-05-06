import React from "react"
import { render, screen, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferringFundsScreen } from "@app/screens/account-migration/to-non-custodial/transferring-funds-screen"
import { ContextForScreen } from "../../helper"

loadLocale("en")

const mockReplace = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    replace: mockReplace,
  }),
}))

jest.mock("@app/components/status-screen-layout", () => ({
  StatusScreenLayout: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID="status-layout">{children}</View>
  },
}))

describe("TransferringFundsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    loadLocale("en")
  })

  afterEach(() => {
    jest.useRealTimers()
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

  it("navigates to success screen after timeout", async () => {
    render(
      <ContextForScreen>
        <TransferringFundsScreen />
      </ContextForScreen>,
    )

    expect(mockReplace).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockReplace).toHaveBeenCalledWith("sparkBackupSuccessScreen")
  })

  it("does not navigate before timeout", async () => {
    render(
      <ContextForScreen>
        <TransferringFundsScreen />
      </ContextForScreen>,
    )

    await act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
