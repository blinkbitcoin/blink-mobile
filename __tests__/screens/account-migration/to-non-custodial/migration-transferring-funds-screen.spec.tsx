import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationTransferringFundsScreen } from "@app/screens/account-migration/to-non-custodial/migration-transferring-funds-screen"
import { MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")

const mockNavigate = jest.fn()
const mockReset = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}))

const mockCompleteMigration = jest.fn()
let mockMigrationAccountId: string | null = "sc-account-1"
let mockMigrationLoading = false
const mockUseHardwareBackGuard = jest.fn()

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    migrationExpectedReceiveSats: 21000,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigration,
  }),
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockUseMigrationTransfer = jest.fn()
let mockIsTransferred = false
let mockIsReceiveDelayed = false
let mockFailureReason: MigrationSupportReason | null = null
let mockIsClockOutOfSync = false
let mockHasConnectionIssue = false
const mockRetry = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-migration-transfer", () => ({
  useMigrationTransfer: (args: unknown) => {
    mockUseMigrationTransfer(args)
    return {
      isTransferred: mockIsTransferred,
      isReceiveDelayed: mockIsReceiveDelayed,
      failureReason: mockFailureReason,
      isClockOutOfSync: mockIsClockOutOfSync,
      hasConnectionIssue: mockHasConnectionIssue,
      retry: mockRetry,
    }
  },
}))

let mockOwnerId: string | null = "custodial-1"

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

jest.mock("@app/components/status-screen-layout", () => ({
  StatusScreenLayout: ({
    children,
    footer,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
  }) => {
    const { View } = jest.requireActual("react-native")
    return (
      <View testID="status-layout">
        {children}
        {footer}
      </View>
    )
  },
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationTransferringFundsScreen />
    </ContextForScreen>,
  )

const rerenderScreen = (rerender: (ui: React.ReactElement) => void) =>
  rerender(
    <ContextForScreen>
      <MigrationTransferringFundsScreen />
    </ContextForScreen>,
  )

describe("MigrationTransferringFundsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOwnerId = "custodial-1"
    mockMigrationAccountId = "sc-account-1"
    mockMigrationLoading = false
    mockIsTransferred = false
    mockIsReceiveDelayed = false
    mockFailureReason = null
    mockIsClockOutOfSync = false
    mockHasConnectionIssue = false
    mockCompleteMigration.mockResolvedValue(true)
    loadLocale("en")
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

  /** The transfer needs both sides: the custodial account the server bills and the
   *  provisioned wallet it pays into. */
  it("drives the transfer with both accounts", async () => {
    renderScreen()
    await flushEffects()

    expect(mockUseMigrationTransfer).toHaveBeenCalledWith({
      custodialAccountId: "custodial-1",
      selfCustodialAccountId: "sc-account-1",
      expectedReceiveSats: 21000,
      skip: false,
    })
  })

  /** The session can end under the screen; the transfer then has no account to bill and
   *  declines to commit rather than guessing one. */
  it("passes no custodial account when the session has gone", async () => {
    mockOwnerId = null
    renderScreen()
    await flushEffects()

    expect(mockUseMigrationTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ custodialAccountId: null }),
    )
  })

  it("waits without transferring while the checkpoint is still loading", async () => {
    mockMigrationLoading = true
    mockMigrationAccountId = null
    renderScreen()
    await flushEffects()

    expect(mockUseMigrationTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** Success resets the stack rather than pushing onto it, so the finished transfer screen
   *  (which swallows back) is gone and a back press on success cannot land on it. */
  it("swaps the session and resets to success once the funds land", async () => {
    mockIsTransferred = true
    renderScreen()
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("swaps the session once, however often it re-renders", async () => {
    mockIsTransferred = true
    const { rerender } = renderScreen()
    await flushEffects()
    rerenderScreen(rerender)
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
  })

  /** The real completeMigration clears the checkpoint and swaps the session, so the
   *  provisioned account disappears on the very success that must not be flagged. */
  it("does not route to support when the successful swap clears the checkpoint", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockImplementation(async () => {
      mockMigrationAccountId = null
      return true
    })

    const { rerender } = renderScreen()
    await flushEffects()
    rerenderScreen(rerender)
    await flushEffects()

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "accountMigrationContactSupport",
      expect.anything(),
    )
    expect(jest.mocked(reportError)).not.toHaveBeenCalled()
  })

  it("routes to contact support when the checkpoint has no provisioned account", async () => {
    mockMigrationAccountId = null
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "self-custodial-account-missing",
      origin: "commit",
    })
    expect(jest.mocked(reportError)).toHaveBeenCalledWith(
      "Migration transfer without provisioned account",
      expect.any(Error),
    )
  })

  /** The transfer names its own failure, so support gets the reason that actually
   *  applies rather than one this screen guessed. */
  it("routes to support with the reason the transfer reported", async () => {
    mockFailureReason = MigrationSupportReason.TransferFailed
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "transfer-failed",
      origin: "commit",
    })
  })

  it("routes to support when the swap does not happen", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockResolvedValue(false)
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "self-custodial-account-missing",
      origin: "commit",
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.anything(),
    )
  })

  it("routes to support when the swap throws", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockRejectedValue(new Error("keystore locked"))
    renderScreen()
    await flushEffects()

    expect(jest.mocked(reportError)).toHaveBeenCalledWith(
      "Migration session swap",
      expect.any(Error),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "transfer-failed",
      origin: "commit",
    })
  })

  /** A skewed clock is the user's to fix, so the screen says so and offers a retry rather
   *  than the one-way handover to support a real failure gets. */
  it("asks the user to fix the clock and offers a retry when it is out of sync", async () => {
    mockIsClockOutOfSync = true
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText(
        "Your device's date and time are out of sync. Set them to automatic to continue.",
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText("Transferring your funds. It should be done in a few seconds."),
    ).toBeNull()
    expect(screen.getByTestId("migration-clock-out-of-sync-retry")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("retries the transfer when the clock-fix button is pressed", async () => {
    mockIsClockOutOfSync = true
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-clock-out-of-sync-retry"))

    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  /** A dropped connection is recoverable, not a failure: the screen names it and offers a
   *  retry instead of handing a transient blip to support. */
  it("shows a connection message and a retry when the commit is lost to the network", async () => {
    mockHasConnectionIssue = true
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText("Connection issue.\nVerify your internet connection"),
    ).toBeTruthy()
    expect(
      screen.queryByText("Transferring your funds. It should be done in a few seconds."),
    ).toBeNull()
    expect(screen.getByTestId("migration-connection-issue-retry")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("retries the transfer when the connection-issue button is pressed", async () => {
    mockHasConnectionIssue = true
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-connection-issue-retry"))

    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  /** The receive gate held the swap past the notice window (#4102): the screen keeps
   *  waiting — the swap still fires by itself — but says so and offers support. */
  it("explains the wait and offers support once the receive is delayed", async () => {
    mockIsReceiveDelayed = true
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText(
        "Your funds are on their way to your new account. This is taking longer than usual — keep the app open and we'll finish up automatically.",
      ),
    ).toBeTruthy()
    expect(
      screen.queryByText("Transferring your funds. It should be done in a few seconds."),
    ).toBeNull()
    expect(mockCompleteMigration).not.toHaveBeenCalled()
    expect(mockReset).not.toHaveBeenCalled()
  })

  /** Its own origin, not the failure handovers': the receive is still being watched here,
   *  and the commit-screen Back would pop this screen off the stack along with the gate. */
  it("navigates to support with the delayed-receive reason and its own origin", async () => {
    mockIsReceiveDelayed = true
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-receive-delayed-contact-support"))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: MigrationSupportReason.ReceiveDelayed,
      origin: "receive-delayed",
    })
  })

  /** A lost connection explains the wait better than the wait itself, and its retry is
   *  the more useful footer, so the recoverable state wins over the delayed notice. */
  it("lets a recoverable issue take over from the delayed notice", async () => {
    mockIsReceiveDelayed = true
    mockHasConnectionIssue = true
    renderScreen()
    await flushEffects()

    expect(
      screen.getByText("Connection issue.\nVerify your internet connection"),
    ).toBeTruthy()
    expect(screen.queryByTestId("migration-receive-delayed-contact-support")).toBeNull()
    expect(screen.getByTestId("migration-connection-issue-retry")).toBeTruthy()
  })

  it("still swaps and resets to success when the receive lands after the notice", async () => {
    mockIsReceiveDelayed = true
    mockIsTransferred = true
    renderScreen()
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
    })
  })
})
