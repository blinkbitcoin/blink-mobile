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
  settings: { autoRefresh: true, cloudSync: false },
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

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { successMessage: "done" } }),
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
    mockActions.bundleState = undefined
    mockActions.sharing = false
    mockActions.copying = false
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

    it("blocks continuing until the backup has actually been exported", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-continue-button"))
      expect(mockCompleteBackup).not.toHaveBeenCalled()
    })

    it("warns before the first download and exports only on confirmation", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))

      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeTruthy()
      expect(mockActions.handleShare).not.toHaveBeenCalled()

      // Two "Download" labels once the modal is open: the modal renders inside
      // the layout's content, the screen's own button in the footer after it.
      const downloads = screen.getAllByText(LL.BackupScreen.BundleExport.download())
      expect(downloads).toHaveLength(2)

      fireEvent.press(downloads[0])
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))
    })

    it("does not re-warn on a second download", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      const downloads = screen.getAllByText(LL.BackupScreen.BundleExport.download())
      fireEvent.press(downloads[0])
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))

      // The warning has been read; a second press exports directly, with no
      // modal confirmation in between.
      fireEvent.press(screen.getByTestId("bundle-download-button"))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(2))
    })

    it("completes the backup once an export has happened", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-copy-button"))
      await waitFor(() => expect(mockActions.handleCopy).toHaveBeenCalled())

      fireEvent.press(screen.getByTestId("bundle-continue-button"))
      expect(mockCompleteBackup).toHaveBeenCalledWith({
        method: BackupMethod.Manual,
        message: "done",
      })
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

  it("does not let the user past the loading state", () => {
    mockActions.bundleState = undefined
    renderScreen()

    fireEvent.press(screen.getByTestId("bundle-continue-button"))
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })
})
