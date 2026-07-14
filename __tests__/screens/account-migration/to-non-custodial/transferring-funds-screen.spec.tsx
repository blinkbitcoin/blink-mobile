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
let mockMigrationLoading = false
const mockUseHardwareBackGuard = jest.fn()

jest.mock("@app/screens/account-migration/hooks", () => ({
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigration,
  }),
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
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
    mockMigrationLoading = false
    mockCompleteMigration.mockResolvedValue(true)
    loadLocale("en")
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("swallows the hardware back while the funds move", async () => {
    renderScreen()
    await flushEffects()

    expect(mockUseHardwareBackGuard).toHaveBeenCalledWith(undefined)
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

  it("waits without acting while the checkpoint is still loading", async () => {
    mockMigrationLoading = true
    mockMigrationAccountId = null
    renderScreen()
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })

    expect(mockCompleteMigration).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("routes to contact support when the checkpoint has no provisioned account", async () => {
    mockMigrationAccountId = null
    renderScreen()
    await flushEffects()

    expect(mockCompleteMigration).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
  })

  it("routes to contact support when the swap does not happen", async () => {
    mockCompleteMigration.mockResolvedValue(false)
    renderScreen()
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.anything(),
    )
  })

  it("routes to the contact support screen when the transfer fails", async () => {
    mockCompleteMigration.mockRejectedValue(new Error("no route found"))
    renderScreen()
    await flushEffects()

    act(() => {
      jest.advanceTimersByTime(TRANSFER_DELAY_MS)
    })
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport")
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.anything(),
    )
  })
})
