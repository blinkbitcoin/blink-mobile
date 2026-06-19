import React from "react"
import { act, render, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferringFundsScreen } from "@app/screens/account-migration/to-non-custodial/transferring-funds-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockCompleteMigration = jest.fn()
let mockMigrationAccountId: string | null = "sc-account-1"
jest.mock("@app/screens/account-migration/hooks", () => ({
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    completeMigration: mockCompleteMigration,
  }),
}))

jest.mock("@app/components/status-screen-layout", () => ({
  StatusScreenLayout: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID="status-layout">{children}</View>
  },
}))

const TRANSFER_DELAY_MS = 3000

const renderScreen = () =>
  render(
    <ContextForScreen>
      <TransferringFundsScreen />
    </ContextForScreen>,
  )

describe("TransferringFundsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    mockMigrationAccountId = "sc-account-1"
    mockCompleteMigration.mockResolvedValue(true)
    loadLocale("en")
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders the transferring funds message in the status layout", async () => {
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText("Transferring your funds. It should be done in a few seconds."),
    ).toBeTruthy()
    expect(screen.getByTestId("status-layout")).toBeTruthy()
  })

  it("swaps the session and navigates to success after the transfer delay", async () => {
    renderScreen()
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: false,
    })
  })

  it("waits without swapping until the provisioned account is available", async () => {
    mockMigrationAccountId = null
    renderScreen()
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })

    expect(mockCompleteMigration).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does not navigate to success when the swap does not happen", async () => {
    mockCompleteMigration.mockResolvedValue(false)
    renderScreen()
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
