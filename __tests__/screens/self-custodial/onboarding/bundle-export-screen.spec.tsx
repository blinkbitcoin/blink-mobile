import React from "react"

import { render, fireEvent, screen, waitFor } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import type { RecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
// Direct import: the onboarding barrel pulls in the biometrics screen, whose
// native fingerprint dep is not transformed for jest.
import { BundleExportScreen } from "@app/screens/self-custodial/onboarding/manual-backup/bundle-export-screen"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"

import { ContextForScreen } from "../../helper"

let LL: TranslationFunctions

const mockCompleteBackup = jest.fn()
const mockActions: RecoveryBundleActions = {
  bundleState: undefined,
  settings: { autoRefresh: true, cloudSync: false, exportedAt: null },
  refreshing: false,
  uploading: false,
  sharing: false,
  copying: false,
  reloadState: jest.fn().mockResolvedValue(undefined),
  handleRefresh: jest.fn(),
  handleShare: jest.fn().mockResolvedValue(undefined),
  handleCopy: jest.fn().mockResolvedValue(undefined),
  handleCloudUpload: jest.fn(),
  handleSetAutoRefresh: jest.fn().mockResolvedValue(undefined),
  handleSetCloudSync: jest.fn().mockResolvedValue(undefined),
}

// The actions hook has its own spec; mocking it keeps this one about the
// screen's two states and the export gate, without pulling in the keystore.
jest.mock(
  "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions",
  () => ({ useRecoveryBundleActions: () => mockActions }),
)

jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  ...jest.requireActual("@app/screens/self-custodial/onboarding/hooks"),
  useCompleteBackup: () => mockCompleteBackup,
}))

const mockNavigate = jest.fn()
const mockParams = jest.fn<{ successMessage?: string } | undefined, []>()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: mockParams() }),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <BundleExportScreen />
    </ContextForScreen>,
  )

describe("BundleExportScreen", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockParams.mockReturnValue({ successMessage: "done" })
    mockActions.bundleState = undefined
    mockActions.sharing = false
    mockActions.copying = false
    // Restored per test: jest.clearAllMocks() clears calls, not implementations,
    // and cases below replace these members outright - without this the
    // replacement leaks into every test that runs after them.
    mockActions.reloadState = jest.fn().mockResolvedValue(undefined)
    // true = the share sheet completed; cases below override it to cover a
    // dismissal, which must not advance the flow.
    mockActions.handleShare = jest.fn().mockResolvedValue(true)
    mockActions.handleCopy = jest.fn().mockResolvedValue(undefined)
  })

  describe("when a recovery backup exists", () => {
    beforeEach(() => {
      mockActions.bundleState = { updatedAt: 1, outputCount: 3 } as never
    })

    it("offers exactly two export actions and no cloud shortcut", () => {
      renderScreen()

      expect(screen.getByTestId("bundle-download-button")).toBeTruthy()
      expect(screen.getByTestId("bundle-copy-button")).toBeTruthy()
      // R7: one cloud button inside the manual flow is what produces
      // "I did the backup, it's in Google Drive" with only the bundle saved.
      expect(screen.queryByText(/google drive/i)).toBeNull()
      expect(screen.queryByText(/icloud/i)).toBeNull()
      expect(screen.queryByText(/cloud/i)).toBeNull()
    })

    it("lets the user skip the export", () => {
      renderScreen()

      // Skipping does not leave them unprotected: the encrypted on-device copy
      // is written automatically, and the home nudge brings them back.
      fireEvent.press(screen.getByTestId("bundle-skip-button"))
      expect(mockCompleteBackup).toHaveBeenCalledWith({
        method: BackupMethod.Manual,
        message: "done",
      })
    })

    it("warns before the first download and exports only on confirmation", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))

      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeTruthy()
      // Assert the body too: React Native drops a bare string inside a View,
      // so passing one to CustomModal renders a warning with no warning in it.
      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveBody())).toBeTruthy()
      expect(mockActions.handleShare).not.toHaveBeenCalled()

      // The modal's confirm is labelled differently from the screen's button,
      // so it can be targeted directly.
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))
    })

    it("does not re-warn on a second download", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))

      // The warning has been read; a second press exports directly, with no
      // modal confirmation in between.
      fireEvent.press(screen.getByTestId("bundle-download-button"))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(2))
    })

    it("confirms the download on its own screen rather than finishing here", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalled())

      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBundleSaved", {
        successMessage: "done",
      })
      expect(mockCompleteBackup).not.toHaveBeenCalled()
    })

    /** Dismissing the OS share sheet is one tap. Advancing anyway would tell the
     *  user their emergency bundle is saved when no file ever left the device -
     *  and the bundle is the artifact a unilateral exit depends on. */
    it("stays put when the share sheet is dismissed", async () => {
      mockActions.handleShare = jest.fn().mockResolvedValue(false)
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalled())

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** The repeat-download path skips the warning modal, so it needs the same
     *  gate: it is the easier of the two to leave unguarded. */
    it("stays put when a repeat share is dismissed", async () => {
      // One mock across both presses: the screen captures the reference it was
      // rendered with, so swapping the member mid-test would leave it calling
      // the original.
      mockActions.handleShare = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
      mockNavigate.mockClear()

      // Second press skips the warning modal and shares straight away.
      fireEvent.press(screen.getByTestId("bundle-download-button"))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(2))

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("copies without leaving the screen", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-copy-button"))
      await waitFor(() => expect(mockActions.handleCopy).toHaveBeenCalled())

      // Copy is a one-shot export (R10), not a step in the flow.
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockCompleteBackup).not.toHaveBeenCalled()
    })

    it("explains unilateral exit on request", () => {
      renderScreen()

      expect(screen.queryByText(LL.BackupScreen.BundleExport.learnMoreBody())).toBeNull()
      fireEvent.press(screen.getByTestId("bundle-learn-more"))
      expect(screen.getByText(LL.BackupScreen.BundleExport.learnMoreBody())).toBeTruthy()
    })

    it("closes the explainer again without exporting or advancing", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-learn-more"))
      fireEvent.press(screen.getByText(LL.common.ok()))
      expect(mockActions.handleShare).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()

      fireEvent.press(screen.getByTestId("bundle-learn-more"))
      fireEvent.press(screen.getByTestId("modal-close"))
      expect(mockActions.handleShare).not.toHaveBeenCalled()
    })

    it("can back out of the download warning without exporting", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeTruthy()

      // Closing the warning must neither download nor advance the flow.
      fireEvent.press(screen.getByTestId("modal-close"))
      expect(mockActions.handleShare).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("when the wallet has no recovery backup yet", () => {
    beforeEach(() => {
      // A new wallet has no outputs, so the exporter cannot build a bundle;
      // there is nothing to hand over and the screen must say so.
      mockActions.bundleState = null
    })

    it("explains that the backup is created later instead of offering a file", () => {
      renderScreen()

      expect(
        screen.getByText(LL.BackupScreen.BundleExport.subtitlePending()),
      ).toBeTruthy()
      expect(screen.queryByTestId("bundle-download-button")).toBeNull()
      expect(screen.queryByTestId("bundle-copy-button")).toBeNull()
    })

    it("lets the user finish, since there is nothing to export", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-continue-button"))
      expect(mockCompleteBackup).toHaveBeenCalledWith({
        method: BackupMethod.Manual,
        message: "done",
      })
    })
  })

  it("does not offer a learn-more link with no bundle to explain", () => {
    mockActions.bundleState = null
    renderScreen()
    expect(screen.queryByTestId("bundle-learn-more")).toBeNull()
  })

  it("does not let the user past the loading state", () => {
    mockActions.bundleState = undefined
    renderScreen()

    fireEvent.press(screen.getByTestId("bundle-continue-button"))
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  it("finishes without a message when the route carries no params", () => {
    mockParams.mockReturnValue(undefined)
    mockActions.bundleState = null
    renderScreen()

    fireEvent.press(screen.getByTestId("bundle-continue-button"))
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: BackupMethod.Manual,
      message: undefined,
    })
  })

  it("survives a failing initial read", () => {
    // The screen has its own empty state; an unhandled rejection here would
    // take the whole onboarding stack down instead of showing it.
    mockActions.reloadState = jest.fn().mockRejectedValue(new Error("nope"))

    expect(() => renderScreen()).not.toThrow()
  })

  /** Skip finishes the backup and navigates away. Left live during an export it
   *  would tear the flow down while the share sheet or the clipboard write is
   *  still resolving into a screen the user has left. */
  describe("skip during an in-flight export", () => {
    beforeEach(() => {
      mockActions.bundleState = { updatedAt: 1, outputCount: 3 } as never
    })

    it("refuses the press while a share is in flight", () => {
      mockActions.sharing = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("bundle-skip-button"))

      expect(mockCompleteBackup).not.toHaveBeenCalled()
    })

    it("refuses the press while a copy is in flight", () => {
      mockActions.copying = true
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("bundle-skip-button"))

      expect(mockCompleteBackup).not.toHaveBeenCalled()
    })

    it("allows the press once nothing is in flight", () => {
      const { getByTestId } = renderScreen()

      fireEvent.press(getByTestId("bundle-skip-button"))

      expect(mockCompleteBackup).toHaveBeenCalled()
    })
  })
})
