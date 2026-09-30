import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationTransferringFundsScreen } from "@app/screens/account-migration/to-non-custodial/migration-transferring-funds-screen"
import { MigrationCompletion, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")

const CLOSE_UNAVAILABLE_MESSAGE =
  "Your funds are safe in your new wallet. We are still closing your old account, please try again in a moment."

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

/** The completion hook owns the custodial id now, so the screen reads it from there rather
 *  than opening a second owner query of its own. */
let mockOwnerId: string | null = "custodial-1"
let mockSparkInvoice: string | null = null
const mockRecordMigrationSparkInvoice = jest.fn()

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useCompleteMigration: () => ({
    migrationAccountId: mockMigrationAccountId,
    migrationExpectedReceiveSats: 21000,
    migrationSparkInvoice: mockSparkInvoice,
    recordMigrationSparkInvoice: mockRecordMigrationSparkInvoice,
    custodialAccountId: mockOwnerId,
    migrationLoading: mockMigrationLoading,
    completeMigration: mockCompleteMigration,
  }),
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockUseMigrationTransfer = jest.fn()
let mockIsTransferred = false
/** Proven unless a case is exercising the delayed-redirect release, which opens the gate
 *  on the notice window without ever seeing the payment land. */
let mockIsReceiveProven = true
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
      isReceiveProven: mockIsReceiveProven,
      isReceiveDelayed: mockIsReceiveDelayed,
      failureReason: mockFailureReason,
      isClockOutOfSync: mockIsClockOutOfSync,
      hasConnectionIssue: mockHasConnectionIssue,
      retry: mockRetry,
    }
  },
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
    mockSparkInvoice = null
    mockMigrationAccountId = "sc-account-1"
    mockMigrationLoading = false
    mockIsTransferred = false
    mockIsReceiveProven = true
    mockIsReceiveDelayed = false
    mockFailureReason = null
    mockIsClockOutOfSync = false
    mockHasConnectionIssue = false
    mockCompleteMigration.mockResolvedValue(MigrationCompletion.Completed)
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
      sparkInvoice: null,
      recordSparkInvoice: mockRecordMigrationSparkInvoice,
      skip: false,
    })
  })

  /** Both come off the completion hook's checkpoint instance rather than a second owner
   *  read of this screen's own, so the invoice is written and read against one id. */
  it("hands the transfer the checkpointed invoice and its recorder", async () => {
    mockSparkInvoice = "lnbcrt1invoice"

    renderScreen()
    await flushEffects()

    expect(mockUseMigrationTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        sparkInvoice: "lnbcrt1invoice",
        recordSparkInvoice: mockRecordMigrationSparkInvoice,
      }),
    )
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

  /** The completion spends this on the account deletion, the one step no retry undoes. */
  it("tells the completion whether the receive was actually seen", async () => {
    mockIsTransferred = true
    mockIsReceiveProven = false
    renderScreen()
    await flushEffects()

    expect(mockCompleteMigration).toHaveBeenCalledWith({ isReceiveProven: false })
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
      return MigrationCompletion.Completed
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
      custodialAccountId: "custodial-1",
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
      custodialAccountId: "custodial-1",
    })
  })

  it("routes to support without an id when the owner query has not resolved", async () => {
    mockOwnerId = null
    mockFailureReason = MigrationSupportReason.TransferFailed
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "transfer-failed",
      origin: "commit",
      custodialAccountId: undefined,
    })
  })

  it("routes to support when the swap does not happen", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockResolvedValue(MigrationCompletion.AccountMissing)
    renderScreen()
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "self-custodial-account-missing",
      origin: "commit",
      custodialAccountId: "custodial-1",
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.anything(),
    )
  })

  /** A throw here is a local step after the funds landed, never a transfer failure. */
  it("routes to support as a completion failure when the swap throws", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockRejectedValue(new Error("keystore locked"))
    renderScreen()
    await flushEffects()

    expect(jest.mocked(reportError)).toHaveBeenCalledWith(
      "Migration session swap",
      expect.any(Error),
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
      reason: "completion-failed",
      origin: "commit",
      custodialAccountId: "custodial-1",
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

  /** The receive gate held the completion past the notice window (#4102): the screen keeps
   *  waiting — the completion still fires by itself — but says so and offers support. */
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

  /** The switch is exhaustive at compile time, so this only happens to a build running
   *  against a completion it does not know about. The if-chain it replaced fell through to
   *  the success screen, which would have told the user the migration finished. */
  it("reports an outcome it does not recognise instead of claiming success", async () => {
    mockIsTransferred = true
    mockCompleteMigration.mockResolvedValue(
      "newly-added-outcome" as unknown as MigrationCompletion,
    )
    renderScreen()
    await flushEffects()

    expect(reportError).toHaveBeenCalledWith(
      "Migration completion unhandled",
      expect.objectContaining({ message: "Unhandled completion: newly-added-outcome" }),
    )
    expect(mockReset).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe("when the account close does not settle", () => {
    beforeEach(() => {
      mockIsTransferred = true
      mockCompleteMigration.mockResolvedValue(MigrationCompletion.CloseUnavailable)
    })

    /** Nothing was discarded and the funds are safe, so the screen offers another attempt
     *  instead of handing a transient blip to support. */
    it("offers a retry rather than routing anywhere", async () => {
      renderScreen()
      await flushEffects()

      expect(screen.getByText(CLOSE_UNAVAILABLE_MESSAGE)).toBeTruthy()
      expect(screen.getByTestId("migration-close-unavailable-retry")).toBeTruthy()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    /** The commonest cause is the server still draining the transfer, where the connection
     *  is fine and the copy would send the user to check a healthy network. */
    it("names the close instead of blaming the connection", async () => {
      renderScreen()
      await flushEffects()

      expect(
        screen.queryByText("Connection issue.\nVerify your internet connection"),
      ).toBeNull()
      expect(screen.queryByTestId("migration-connection-issue-retry")).toBeNull()
    })

    /** The transfer already landed, so the press must retry the close, not the transfer. */
    it("retries the completion, not the transfer, when the button is pressed", async () => {
      renderScreen()
      await flushEffects()

      mockCompleteMigration.mockResolvedValue(MigrationCompletion.Completed)
      fireEvent.press(screen.getByTestId("migration-close-unavailable-retry"))
      await flushEffects()

      expect(mockCompleteMigration).toHaveBeenCalledTimes(2)
      expect(mockRetry).not.toHaveBeenCalled()
    })

    /** The footer named the clock but the press retried the close, so the button did
     *  something other than what it said. */
    it("names the close, not the clock, when both are unsettled", async () => {
      mockIsClockOutOfSync = true
      renderScreen()
      await flushEffects()

      expect(screen.getByText(CLOSE_UNAVAILABLE_MESSAGE)).toBeTruthy()
      expect(screen.queryByTestId("migration-clock-out-of-sync-retry")).toBeNull()

      mockCompleteMigration.mockResolvedValue(MigrationCompletion.Completed)
      fireEvent.press(screen.getByTestId("migration-close-unavailable-retry"))
      await flushEffects()

      expect(mockCompleteMigration).toHaveBeenCalledTimes(2)
      expect(mockRetry).not.toHaveBeenCalled()
    })

    it("resets to success once a retried close settles", async () => {
      renderScreen()
      await flushEffects()

      mockCompleteMigration.mockResolvedValue(MigrationCompletion.Completed)
      fireEvent.press(screen.getByTestId("migration-close-unavailable-retry"))
      await flushEffects()

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
      })
    })

    it("does not fire a second completion while the first is still unsettled", async () => {
      const { rerender } = renderScreen()
      await flushEffects()
      rerenderScreen(rerender)
      await flushEffects()

      expect(mockCompleteMigration).toHaveBeenCalledTimes(1)
    })
  })

  describe("when the server refuses the account close for good", () => {
    beforeEach(() => {
      mockIsTransferred = true
      mockCompleteMigration.mockResolvedValue(MigrationCompletion.CloseRefused)
    })

    /** Home sits under the handover, never the success screen: success auto-navigates home
     *  a couple of seconds after its animation, from wherever it is mounted, and would take
     *  the handover with it. */
    it("puts home under the handover instead of the auto-navigating success screen", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReset).toHaveBeenCalledWith({
        index: 1,
        routes: [
          { name: "Primary" },
          {
            name: "accountMigrationContactSupport",
            params: {
              reason: "custodial-account-close-refused",
              origin: "close-refused",
              custodialAccountId: "custodial-1",
            },
          },
        ],
      })
    })

    /** The session is discarded by the time support opens, so the live account query can no
     *  longer name the custodial account the ticket is about. */
    it("names the custodial account the ticket is about", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReset).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({ custodialAccountId: "custodial-1" }),
            }),
          ]),
        }),
      )
    })

    it("never lands on the success screen, whose timer would clear the handover", async () => {
      renderScreen()
      await flushEffects()

      expect(mockReset).not.toHaveBeenCalledWith(
        expect.objectContaining({
          routes: [{ name: "selfCustodialBackupSuccess", params: { reBackup: false } }],
        }),
      )
    })

    it("hands over without an id when the custodial owner is unknown", async () => {
      mockOwnerId = null
      renderScreen()
      await flushEffects()

      expect(mockReset).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: expect.arrayContaining([
            expect.objectContaining({
              params: expect.objectContaining({ custodialAccountId: undefined }),
            }),
          ]),
        }),
      )
    })

    /** The refusal is the server's settled answer, not a defect worth a crash report. */
    it("does not report the refusal", async () => {
      renderScreen()
      await flushEffects()

      expect(jest.mocked(reportError)).not.toHaveBeenCalled()
    })

    it("offers no retry, because no retry ever clears the refusal", async () => {
      renderScreen()
      await flushEffects()

      expect(screen.queryByTestId("migration-connection-issue-retry")).toBeNull()
      expect(screen.queryByTestId("migration-close-unavailable-retry")).toBeNull()
    })
  })
})
