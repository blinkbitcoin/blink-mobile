import React from "react"

import { render } from "@testing-library/react-native"

import { AccountScreen } from "@app/screens/settings-screen/account/account-screen"
import { BackupStatus } from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey0: "#ccc",
    grey1: "#aaa",
    grey2: "#999",
    grey4: "#eee",
    grey5: "#f5f5f5",
    grey6: "#fafafa",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
    error: "#f00",
    transparent: "transparent",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, unknown>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, unknown> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    Skeleton: () => null,
    Avatar: ({ title }: { title?: string }) =>
      React.createElement("Text", { testID: "avatar" }, title),
    Divider: () => null,
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("Screen", null, children),
}))

const captureRefreshControl: {
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
} = {}
jest.mock("react-native-gesture-handler", () => {
  const RNs = jest.requireActual<typeof import("react-native")>("react-native")
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  return {
    ScrollView: ({
      children,
      refreshControl,
    }: {
      children?: React.ReactNode
      refreshControl?: React.ReactNode
    }) => ReactNs.createElement(RNs.View, null, refreshControl, children),
    RefreshControl: ({
      onRefresh,
      refreshing,
    }: {
      onRefresh?: () => void | Promise<void>
      refreshing?: boolean
    }) => {
      captureRefreshControl.onRefresh = onRefresh
      captureRefreshControl.refreshing = refreshing
      return null
    },
    TouchableOpacity: RNs.TouchableOpacity,
    TouchableWithoutFeedback: RNs.TouchableOpacity,
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, reset: jest.fn() }),
}))

const mockUseAccountInfo = jest.fn()
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-info", () => ({
  useSelfCustodialAccountInfo: () => mockUseAccountInfo(),
}))

const mockUseBackupState = jest.fn()
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Pending: "pending", Completed: "completed" },
  useBackupState: () => mockUseBackupState(),
}))

const mockActiveAccount = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

const mockUpdateCurrentProfile = jest.fn()
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
}))

jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { NonAuth: "NON_AUTH", Zero: "ZERO", One: "ONE", Two: "TWO" },
  useLevel: () => ({
    currentLevel: "NON_AUTH",
    isAtLeastLevelZero: false,
    isAtLeastLevelOne: false,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: () => ({ data: null, loading: false }),
}))

const mockRefreshSelfCustodialWallets = jest.fn().mockResolvedValue(undefined)
const mockUpdateCurrentSelfCustodialAccount = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    lightningAddress: "satoshi@blink.sv",
    refreshWallets: mockRefreshSelfCustodialWallets,
    updateCurrentSelfCustodialAccount: mockUpdateCurrentSelfCustodialAccount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  const sync = jest.requireActual<typeof import("@app/i18n/i18n-util.sync")>(
    "@app/i18n/i18n-util.sync",
  )
  const util =
    jest.requireActual<typeof import("@app/i18n/i18n-util")>("@app/i18n/i18n-util")
  sync.loadLocale("en")
  const LL = util.i18nObject("en")
  return {
    __esModule: true,
    default: () => null,
    useI18nContext: () => ({ LL, locale: "en" }),
  }
})

jest.mock("@app/screens/settings-screen/account/account-delete-context", () => ({
  AccountDeleteContextProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", null, children),
}))

jest.mock("@app/screens/settings-screen/account/settings/danger-zone", () => ({
  DangerZoneSettings: () => React.createElement("View", { testID: "danger-zone" }),
}))

jest.mock("@app/screens/settings-screen/account/settings/upgrade-trial-account", () => ({
  UpgradeTrialAccount: () => React.createElement("View", { testID: "upgrade-trial" }),
}))

jest.mock("@app/screens/settings-screen/account/settings/upgrade", () => ({
  UpgradeAccountLevelOne: () => null,
}))

jest.mock("@app/screens/settings-screen/account/id", () => ({
  AccountId: () => React.createElement("View", { testID: "account-id" }),
}))

describe("AccountScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseBackupState.mockReturnValue({
      backupState: { status: BackupStatus.Completed },
    })
    mockUseAccountInfo.mockReturnValue({
      identityPubkey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      lightningAddress: "magentamouse1845@breez.tips",
      loading: false,
      error: null,
    })
  })

  describe("self-custodial mode", () => {
    beforeEach(() => {
      mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
    })

    it("renders Wallet identifier, Lightning address, and Backup status fields", () => {
      const { getByText, getByTestId } = render(<AccountScreen />)

      expect(getByText("Wallet identifier")).toBeTruthy()
      expect(getByText("Lightning address")).toBeTruthy()
      expect(getByText("Backup status")).toBeTruthy()
      expect(getByTestId("account-info-backup-status").props.children).toBe(
        "Backup complete",
      )
    })

    it("hides custodial-only rows", () => {
      const { queryByTestId } = render(<AccountScreen />)

      expect(queryByTestId("upgrade-trial")).toBeNull()
      expect(queryByTestId("account-id")).toBeNull()
    })

    it("still renders the Danger zone row", () => {
      const { getByTestId } = render(<AccountScreen />)

      expect(getByTestId("danger-zone")).toBeTruthy()
    })

    it("shows Backup not complete when backup is pending", () => {
      mockUseBackupState.mockReturnValue({
        backupState: { status: BackupStatus.Pending },
      })

      const { getByTestId } = render(<AccountScreen />)

      expect(getByTestId("account-info-backup-status").props.children).toBe(
        "Backup not complete",
      )
    })

    it("pull-to-refresh refreshes the self-custodial wallets and never hits updateCurrentProfile", async () => {
      render(<AccountScreen />)

      await captureRefreshControl.onRefresh?.()

      expect(mockRefreshSelfCustodialWallets).toHaveBeenCalledTimes(1)
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    })

    it("clears the refreshing flag even when the self-custodial refresh rejects", async () => {
      mockRefreshSelfCustodialWallets.mockRejectedValueOnce(new Error("offline"))

      render(<AccountScreen />)

      await Promise.resolve(captureRefreshControl.onRefresh?.()).catch(() => undefined)

      expect(captureRefreshControl.refreshing).toBe(false)
    })

    it("hides the Lightning address field when the wallet has no LN address yet", () => {
      mockUseAccountInfo.mockReturnValue({
        identityPubkey: "abc",
        lightningAddress: null,
        loading: false,
        error: null,
      })

      const { queryByText } = render(<AccountScreen />)

      expect(queryByText("Lightning address")).toBeNull()
    })
  })

  describe("custodial mode", () => {
    beforeEach(() => {
      mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    })

    it("pull-to-refresh calls updateCurrentProfile (custodial behavior unchanged)", async () => {
      render(<AccountScreen />)

      await captureRefreshControl.onRefresh?.()

      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
      expect(mockRefreshSelfCustodialWallets).not.toHaveBeenCalled()
    })

    it("clears the refreshing flag even when updateCurrentProfile rejects", async () => {
      mockUpdateCurrentProfile.mockRejectedValueOnce(new Error("offline"))

      render(<AccountScreen />)

      await Promise.resolve(captureRefreshControl.onRefresh?.()).catch(() => undefined)

      expect(captureRefreshControl.refreshing).toBe(false)
    })

    it("renders the existing custodial layout (AccountId + upgrade rows)", () => {
      const { getByTestId, queryByText } = render(<AccountScreen />)

      expect(getByTestId("account-id")).toBeTruthy()
      expect(getByTestId("upgrade-trial")).toBeTruthy()
      expect(queryByText("Wallet identifier")).toBeNull()
      expect(queryByText("Backup status")).toBeNull()
    })

    it("still renders the Danger zone row", () => {
      const { getByTestId } = render(<AccountScreen />)

      expect(getByTestId("danger-zone")).toBeTruthy()
    })
  })
})
