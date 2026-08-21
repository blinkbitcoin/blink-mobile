import React from "react"
import { render, waitFor } from "@testing-library/react-native"

import { MigrationGate } from "@app/screens/account-migration/to-non-custodial/migration-gate"

import { walletOverviewQueryResult } from "../helpers"

/**
 * Integration seam the unit specs cannot reach: the gate spec mocks
 * useReusablePendingWallet wholesale and the hook specs mock each other, so nothing
 * exercises the gate's resume-or-handover decision against the REAL pending-account
 * logic. Here only storage and the unrelated gate inputs are mocked; the pending
 * record chain (usePendingMigrationAccounts → useReusablePendingWallet → gate) runs
 * for real, including the self-heal that drops a record pointing at the active account.
 */

const mockNavigate = jest.fn()
const mockNavigateToCheckpoint = jest.fn()
const mockLoadPendingProvisionedAccounts = jest.fn()
const mockClearPendingProvisionedAccount = jest.fn()
const mockReportError = jest.fn()
let mockActiveAccount: { id: string; type: string } | undefined
let mockRegistryAccounts: { id: string }[] = []

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useIsFocused: () => true,
  /** The real pending-accounts hook loads through useFocusEffect; outside a navigation
   *  container it must run as a plain effect. */
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(() => callback(), [callback])
  },
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { colors: { primary: "#fb5607", warning: "#f0a202" } } }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/** The barrel spread keeps usePendingMigrationAccounts real; the checkpoint hook is
 *  stubbed to "nothing resumable" so the decision rides on the pending chain alone. */
jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useActiveApiKeys: () => ({
    hasActiveApiKeys: false,
    loading: false,
    isReady: true,
    hasError: false,
    refetch: jest.fn(),
  }),
  useMigrationCheckpoint: () => ({
    navigateToCheckpoint: mockNavigateToCheckpoint,
    loading: false,
    hasError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    hasResumableCheckpoint: false,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    isLocked: true,
    loading: false,
    hasError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock("@app/screens/account-migration/utils/migration-checkpoint-storage", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/utils/migration-checkpoint-storage",
  ),
  loadPendingProvisionedAccounts: (...args: readonly unknown[]) =>
    mockLoadPendingProvisionedAccounts(...args),
  clearPendingProvisionedAccount: (...args: readonly unknown[]) =>
    mockClearPendingProvisionedAccount(...args),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: "custodial-1", loading: false }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: mockRegistryAccounts,
    activeAccount: mockActiveAccount,
    loading: false,
    reloadSelfCustodialAccounts: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-wind-down", () => ({
  useCustodialWindDown: () => null,
}))

jest.mock("@app/screens/account-migration/hooks/use-self-custodial-disabled", () => ({
  useSelfCustodialDisabled: () => false,
}))

jest.mock("@app/screens/conversion-flow/drain-conversion", () => ({
  armMigrationConversion: jest.fn(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => walletOverviewQueryResult({ usdBalance: 0 }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-transfer-blocked", () => ({
  useTransferBlocked: () => false,
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => false,
}))

jest.mock("@app/components/dollar-balance-migration-modal", () => ({
  DollarBalanceMigrationModal: () => null,
}))

jest.mock("@app/screens/account-migration/to-non-custodial/api-service-screen", () => ({
  MigrationApiServiceScreen: () => null,
}))

jest.mock(
  "@app/screens/account-migration/to-non-custodial/migration-required-screen",
  () => ({
    MigrationRequiredScreen: () => null,
  }),
)

jest.mock("@app/screens/feature-unavailable/temporarily-unavailable-screen", () => ({
  TemporarilyUnavailableScreen: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      errors: { generic: () => "generic error" },
      common: { tryAgain: () => "Try Again" },
    },
  }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

describe("MigrationGate pending-wallet integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockRegistryAccounts = [{ id: "custodial-1" }]
    mockLoadPendingProvisionedAccounts.mockResolvedValue({})
    mockClearPendingProvisionedAccount.mockResolvedValue(undefined)
  })

  /** A crash without a reinstall keeps the record and its wallet: the real chain must
   *  read the stored record, find the wallet in the registry, and resume — the same
   *  predicate ensureAccount will apply when the restarted flow reuses that wallet. */
  it("resumes when the stored pending record's wallet still exists on the device", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-account-1",
    })
    mockRegistryAccounts = [{ id: "custodial-1" }, { id: "sc-account-1" }]

    render(<MigrationGate />)

    await waitFor(() => expect(mockNavigateToCheckpoint).toHaveBeenCalledTimes(1))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** A record pointing at the ACTIVE account is a completed migration whose cleanup
   *  write was lost: the real hook self-heals it away, so nothing is reusable and the
   *  locked gate hands over — instead of "resuming" onto the account already in use. */
  it("hands over after the self-heal drops a record pointing at the active account", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
    })
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }
    mockRegistryAccounts = [{ id: "custodial-1" }, { id: "sc-wallet-1" }]

    render(<MigrationGate />)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
        reason: "locked-without-checkpoint",
        origin: "gate",
      }),
    )
    expect(mockClearPendingProvisionedAccount).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      "custodial-1",
    )
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })

  /** The wiped-device signature end to end: an empty store (fresh reinstall) with the
   *  lock still set must end at support, never at another provisioned orphan. */
  it("hands over when the store holds no pending record at all", async () => {
    render(<MigrationGate />)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("accountMigrationContactSupport", {
        reason: "locked-without-checkpoint",
        origin: "gate",
      }),
    )
    expect(mockNavigateToCheckpoint).not.toHaveBeenCalled()
  })
})
