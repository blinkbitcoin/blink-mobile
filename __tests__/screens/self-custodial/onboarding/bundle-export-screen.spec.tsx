import React from "react"
import { Linking } from "react-native"

import { render, fireEvent, screen, waitFor } from "@testing-library/react-native"

import { UNILATERAL_EXIT_CASE_STUDY_URL } from "@app/config"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import type { RecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
// Direct import: the onboarding barrel pulls in the biometrics screen, whose
// native fingerprint dep is not transformed for jest.
import { BundleExportScreen } from "@app/screens/self-custodial/onboarding/manual-backup/bundle-export-screen"

import { ContextForScreen } from "../../helper"

let LL: TranslationFunctions

const mockActions: RecoveryBundleActions = {
  bundleState: undefined,
  settings: { autoRefresh: true, cloudSync: false },
  settingsLoaded: true,
  sharing: false,
  reloadState: jest.fn().mockResolvedValue(undefined),
  handleShare: jest.fn().mockResolvedValue(true),
}

// The actions hook has its own spec; mocking it keeps this one about the
// screen's three states, without pulling in the keystore.
jest.mock(
  "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions",
  () => ({ useRecoveryBundleActions: () => mockActions }),
)

const mockIsPasswordProtected = jest.fn()
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: null }),
  isPasswordProtectedCloudSeedBackup: () => mockIsPasswordProtected(),
}))

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockParams = jest.fn<
  { fromOnboarding?: boolean; successMessage?: string } | undefined,
  []
>()
jest.mock("@react-navigation/native", () => {
  const ReactActual = jest.requireActual("react")
  return {
    ...jest.requireActual("@react-navigation/native"),
    useRoute: () => ({ params: mockParams() }),
    useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      ReactActual.useEffect(effect, [effect])
    },
  }
})

const renderScreen = () =>
  render(
    <ContextForScreen>
      <BundleExportScreen />
    </ContextForScreen>,
  )

const savedBundle = { savedAt: 1, leafCount: 3 } as never

describe("BundleExportScreen", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockParams.mockReturnValue(undefined)
    mockIsPasswordProtected.mockReturnValue(false)
    mockActions.bundleState = savedBundle
    mockActions.settings = { autoRefresh: true, cloudSync: false }
    mockActions.sharing = false
    // Restored per test: cases below replace these members outright.
    mockActions.reloadState = jest.fn().mockResolvedValue(undefined)
    mockActions.handleShare = jest.fn().mockResolvedValue(true)
  })

  it("is titled Emergency bundle", () => {
    renderScreen()

    expect(screen.getByText(LL.BackupScreen.BundleExport.title())).toBeTruthy()
  })

  describe("from the manual backup (onboarding)", () => {
    beforeEach(() => {
      mockParams.mockReturnValue({ fromOnboarding: true, successMessage: "done" })
    })

    it("offers the cloud backup and a skip", () => {
      renderScreen()

      expect(screen.getByText(LL.BackupScreen.BundleExport.bodyOnboarding())).toBeTruthy()
      expect(screen.getByTestId("bundle-cloud-backup-button")).toBeTruthy()
      expect(screen.getByTestId("bundle-skip-button")).toBeTruthy()
      expect(screen.queryByTestId("bundle-download-button")).toBeNull()
    })

    it("opens the cloud backup flow", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-cloud-backup-button"))
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
    })

    it("skips to the success screen without staying in the back stack", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-skip-button"))
      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
        message: "done",
      })
    })

    it("does not wait for the stored settings, which it does not depend on", () => {
      mockActions.bundleState = undefined
      renderScreen()

      expect(screen.getByTestId("bundle-cloud-backup-button")).toBeTruthy()
    })
  })

  describe("from Settings with automatic backups off", () => {
    it("offers to activate backups", () => {
      renderScreen()

      expect(screen.getByText(LL.BackupScreen.BundleExport.bodyBackupsOff())).toBeTruthy()
      fireEvent.press(screen.getByTestId("bundle-activate-backups-button"))
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
      expect(screen.queryByTestId("bundle-skip-button")).toBeNull()
    })

    /** A cloud backup without a passphrase never uploads the bundle, so it must
     *  not read as "turned on". */
    it("stays off when sync is enabled but the cloud backup has no passphrase", () => {
      mockActions.settings = { autoRefresh: true, cloudSync: true }
      renderScreen()

      expect(screen.getByTestId("bundle-activate-backups-button")).toBeTruthy()
    })

    it("stays off when the cloud backup has a passphrase but sync is disabled", () => {
      mockIsPasswordProtected.mockReturnValue(true)
      renderScreen()

      expect(screen.getByTestId("bundle-activate-backups-button")).toBeTruthy()
    })
  })

  describe("from Settings with automatic backups on", () => {
    beforeEach(() => {
      mockIsPasswordProtected.mockReturnValue(true)
      mockActions.settings = { autoRefresh: true, cloudSync: true }
    })

    it("offers the latest bundle for download", () => {
      renderScreen()

      expect(screen.getByText(LL.BackupScreen.BundleExport.bodyBackupsOn())).toBeTruthy()
      expect(screen.getByTestId("bundle-download-button")).toBeTruthy()
      expect(screen.queryByTestId("bundle-activate-backups-button")).toBeNull()
    })

    it("warns before the first download and exports only on confirmation", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))

      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeTruthy()
      // Assert the body too: React Native drops a bare string inside a View,
      // so passing one to CustomModal renders a warning with no warning in it.
      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveBody())).toBeTruthy()
      expect(mockActions.handleShare).not.toHaveBeenCalled()

      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))
    })

    it("does not re-warn on a second download", async () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(2))
    })

    it("warns again after a dismissed share sheet", async () => {
      mockActions.handleShare = jest.fn().mockResolvedValue(false)
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.sensitiveConfirm()))
      await waitFor(() => expect(mockActions.handleShare).toHaveBeenCalledTimes(1))

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      expect(screen.getByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeTruthy()
      expect(mockActions.handleShare).toHaveBeenCalledTimes(1)
    })

    it("cannot download before the wallet has a bundle", () => {
      // A wallet that has never held funds has nothing to hand over.
      mockActions.bundleState = null
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-download-button"))
      expect(screen.queryByText(LL.BackupScreen.BundleExport.sensitiveTitle())).toBeNull()
    })
  })

  it("waits for the stored settings before choosing a Settings state", () => {
    // Guessing "off" first would flash the wrong copy and CTA for users whose
    // backups are on.
    mockActions.bundleState = undefined
    renderScreen()

    expect(screen.queryByTestId("bundle-activate-backups-button")).toBeNull()
    expect(screen.queryByTestId("bundle-download-button")).toBeNull()
  })

  describe("learn more", () => {
    it("explains how recovery works", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-learn-more"))
      expect(screen.getByText(LL.RecoveryBundleScreen.howItWorksTitle())).toBeTruthy()
      expect(screen.getByText(LL.RecoveryBundleScreen.howItWorksBody())).toBeTruthy()
    })

    it("opens the case study in the browser", () => {
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true)
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-learn-more"))
      fireEvent.press(screen.getByText(LL.BackupScreen.BundleExport.readCaseStudy()))
      expect(openURL).toHaveBeenCalledWith(UNILATERAL_EXIT_CASE_STUDY_URL)
    })
  })

  it("survives a failing initial read", () => {
    mockActions.reloadState = jest.fn().mockRejectedValue(new Error("nope"))

    expect(() => renderScreen()).not.toThrow()
  })
})
