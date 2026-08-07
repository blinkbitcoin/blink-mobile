import React from "react"

import { render, fireEvent, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { RecoveryBackupNudgeBanner } from "@app/self-custodial/components/recovery-backup-nudge-banner"
import { RecoveryBackupNudgeVariant } from "@app/self-custodial/hooks/use-recovery-backup-nudge"

import { ContextForScreen } from "../../screens/helper"

let LL: TranslationFunctions

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockDismiss = jest.fn()

const renderBanner = (variant: RecoveryBackupNudgeVariant) =>
  render(
    <ContextForScreen>
      <RecoveryBackupNudgeBanner variant={variant} onDismiss={mockDismiss} />
    </ContextForScreen>,
  )

describe("RecoveryBackupNudgeBanner", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => jest.clearAllMocks())

  const t = () => LL.RecoveryBundleScreen

  it("names the problem when there is no backup at all", () => {
    renderBanner(RecoveryBackupNudgeVariant.Missing)

    expect(screen.getByText(t().nudgeMissingTitle())).toBeTruthy()
    expect(screen.getByText(t().nudgeMissingBody())).toBeTruthy()
  })

  it("names the problem when the backup is out of date", () => {
    renderBanner(RecoveryBackupNudgeVariant.Stale)

    expect(screen.getByText(t().nudgeStaleTitle())).toBeTruthy()
    expect(screen.getByText(t().nudgeStaleBody())).toBeTruthy()
  })

  it("names the problem when the backup never left the device", () => {
    renderBanner(RecoveryBackupNudgeVariant.OnlyOnThisDevice)

    expect(screen.getByText(t().nudgeOnlyOnThisDeviceTitle())).toBeTruthy()
    expect(screen.getByText(t().nudgeOnlyOnThisDeviceBody())).toBeTruthy()
  })

  it("never offers cloud as the way out", () => {
    // Manual and cloud are one-or-the-other. A cloud offer here would rebuild
    // that hybrid in the surface most likely to be seen.
    renderBanner(RecoveryBackupNudgeVariant.OnlyOnThisDevice)

    expect(screen.queryByText(/cloud/i)).toBeNull()
    expect(screen.queryByText(/drive/i)).toBeNull()
    expect(screen.queryByText(/icloud/i)).toBeNull()
  })

  it("opens the recovery backup screen", () => {
    renderBanner(RecoveryBackupNudgeVariant.Stale)

    fireEvent.press(screen.getByText(t().nudgeCta()))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRecoveryBackup")
  })

  it("can be dismissed when it is a reminder", () => {
    renderBanner(RecoveryBackupNudgeVariant.Stale)

    // NotificationCardUI renders dismissal as a GaloyIconButton; GaloyIcon
    // tags itself `icon-<name>`.
    fireEvent.press(screen.getByTestId("icon-close"))
    expect(mockDismiss).toHaveBeenCalled()
  })

  it("cannot be dismissed when funds have no backup at all", () => {
    // Funds with no recovery path is a condition, not a reminder.
    renderBanner(RecoveryBackupNudgeVariant.Missing)

    expect(screen.queryByTestId("icon-close")).toBeNull()
  })
})
