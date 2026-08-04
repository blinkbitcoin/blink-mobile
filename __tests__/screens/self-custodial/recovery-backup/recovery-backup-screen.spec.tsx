import React from "react"
import { ActivityIndicator } from "react-native"

import { render, fireEvent } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { RecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"

import { RecoveryBackupScreen } from "@app/screens/self-custodial/recovery-backup"
import { getCloudProviderName } from "@app/screens/self-custodial/onboarding/utils"
import { ContextForScreen } from "../../helper"

const mockUseBackupState = jest.fn()
const mockActions: RecoveryBundleActions = {
  bundleState: undefined,
  settings: { autoRefresh: true, cloudSync: false },
  refreshing: false,
  uploading: false,
  sharing: false,
  copying: false,
  reloadState: jest.fn().mockResolvedValue(undefined),
  handleRefresh: jest.fn(),
  handleShare: jest.fn(),
  handleCopy: jest.fn(),
  handleCloudUpload: jest.fn(),
  handleSetAutoRefresh: jest.fn().mockResolvedValue(undefined),
  handleSetCloudSync: jest.fn().mockResolvedValue(undefined),
}

// The actions hook has its own spec; mocking it keeps this one about the
// screen's gating and wiring only (and keeps share/keystore deps out).
jest.mock(
  "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions",
  () => ({
    useRecoveryBundleActions: () => mockActions,
  }),
)

// Keep the real gate helpers: the three-way cloud section split under test is
// the production isCloudSeedBackupCompleted / isPasswordProtectedCloudSeedBackup
// logic, not a re-implementation.
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => mockUseBackupState(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
  }
})

loadLocale("en")
const LL = i18nObject("en")
// Same platform-derived provider name the screen renders with.
const provider = getCloudProviderName(LL)

const savedState = {
  savedAt: 1_700_000_000_000,
  bundleCreatedAt: "2023-11-14T22:13:20Z",
  leafCount: 3,
  totalSats: "21000",
  cloudSyncedAt: null,
}

const renderScreen = () =>
  render(
    <ContextForScreen>
      <RecoveryBackupScreen />
    </ContextForScreen>,
  )

describe("RecoveryBackupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActions.bundleState = savedState
    mockActions.settings = { autoRefresh: true, cloudSync: false }
    mockActions.sharing = false
    mockActions.copying = false
    mockUseBackupState.mockReturnValue({
      backupState: { status: "none", method: null },
    })
  })

  it("shows a spinner while the first state read is in flight", () => {
    mockActions.bundleState = undefined
    const rendered = renderScreen()
    expect(rendered.UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
    expect(rendered.queryByText(LL.RecoveryBundleScreen.noBundleYet())).toBeNull()
  })

  it("shows the no-bundle copy and disables exports when nothing is saved", () => {
    mockActions.bundleState = null
    const { getByText, getByTestId } = renderScreen()
    expect(getByText(LL.RecoveryBundleScreen.noBundleYet())).toBeTruthy()
    expect(getByTestId("recovery-bundle-share")).toBeDisabled()
    expect(getByTestId("recovery-bundle-copy")).toBeDisabled()
  })

  it("without any cloud seed backup: shows the follows-seed hint, no switch, no upload button", () => {
    const { getByText, queryByTestId } = renderScreen()
    expect(
      getByText(LL.RecoveryBundleScreen.cloudFollowsSeedBackup({ provider })),
    ).toBeTruthy()
    expect(queryByTestId("recovery-bundle-cloud-sync-switch")).toBeNull()
    expect(queryByTestId("recovery-bundle-cloud-upload")).toBeNull()
  })

  it("with a passwordless cloud seed backup: shows the needs-password hint instead of the switch (D9)", () => {
    mockUseBackupState.mockReturnValue({
      backupState: { status: "completed", method: "cloud" },
    })
    const { getByText, queryByTestId } = renderScreen()
    expect(
      getByText(LL.RecoveryBundleScreen.cloudSyncNeedsPassword({ provider })),
    ).toBeTruthy()
    expect(queryByTestId("recovery-bundle-cloud-sync-switch")).toBeNull()
    expect(queryByTestId("recovery-bundle-cloud-upload")).toBeNull()
  })

  it("with a password-protected cloud seed backup: shows the switch; upload button only once opted in", () => {
    mockUseBackupState.mockReturnValue({
      backupState: {
        status: "completed",
        method: "cloud",
        cloudPasswordProtected: true,
      },
    })
    const first = renderScreen()
    expect(first.getByTestId("recovery-bundle-cloud-sync-switch")).toBeTruthy()
    expect(first.queryByTestId("recovery-bundle-cloud-upload")).toBeNull()
    first.unmount()

    mockActions.settings = { autoRefresh: true, cloudSync: true }
    const second = renderScreen()
    expect(second.getByTestId("recovery-bundle-cloud-upload")).toBeTruthy()
  })

  it("flipping the cloud switch calls handleSetCloudSync with the new value", () => {
    mockUseBackupState.mockReturnValue({
      backupState: {
        status: "completed",
        method: "cloud",
        cloudPasswordProtected: true,
      },
    })
    const { getByTestId } = renderScreen()
    // The atomic Switch fires on pressIn, not press.
    fireEvent(getByTestId("recovery-bundle-cloud-sync-switch"), "pressIn")
    expect(mockActions.handleSetCloudSync).toHaveBeenCalledWith(true)
  })

  it("flipping the auto-refresh switch calls handleSetAutoRefresh with the new value", () => {
    const { getByTestId } = renderScreen()
    fireEvent(getByTestId("recovery-bundle-auto-refresh-switch"), "pressIn")
    expect(mockActions.handleSetAutoRefresh).toHaveBeenCalledWith(false)
  })

  it("shows the copy-in-progress spinner on the Copy JSON button only", () => {
    mockActions.copying = true
    const { getByTestId, queryByText } = renderScreen()
    expect(getByTestId("recovery-bundle-share")).toBeTruthy()
    // RNE Button renders a spinner instead of the title while loading.
    expect(queryByText(LL.RecoveryBundleScreen.copyJson())).toBeNull()
    expect(queryByText(LL.RecoveryBundleScreen.exportFile())).toBeTruthy()
  })
})
