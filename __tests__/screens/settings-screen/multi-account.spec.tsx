import React from "react"
import { render, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { MockedProvider } from "@apollo/client/testing"
import { createCache } from "@app/graphql/cache"
import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import { SwitchAccount } from "@app/screens/settings-screen/account/multi-account/switch-account"
import { fetchProfiles } from "@app/screens/settings-screen/account/multi-account/utils"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { ContextForScreen } from "../helper"

const SwitchAccountComponent = () => (
  <MockedProvider cache={createCache()}>
    <IsAuthedContextProvider value={true}>
      <SwitchAccount />
    </IsAuthedContextProvider>
  </MockedProvider>
)

const expectedProfiles = [
  {
    accountId: "e192afc7-ef8e-5a00-b288-cad1eb5360fb",
    email: "user@test.com",
    identifier: "TestUser",
    phone: "+50312345678",
    selected: true,
    token: "mock-token-1",
    userId: "70df9822-efe0-419c-b864-c9efa99872ea",
  },
]

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getSessionProfiles: jest.fn(),
    saveSessionProfiles: jest.fn(),
    removeSessionProfiles: jest.fn(),
    removeProfileByUserId: jest.fn(),
  },
}))

const mockSaveProfile = jest.fn()
let mockAppConfigToken = "mock-token-1"

let mockSelfCustodialEntries: { id: string; createdAt: number }[] = []
let mockPendingAccountIds = new Set<string>()
let mockPendingForActiveAccount: string | null = null
let mockMigrationCompleted = false

jest.mock("@app/screens/account-migration/hooks/use-migration-lock", () => ({
  useMigrationLock: () => ({
    isLocked: false,
    isCompleted: mockMigrationCompleted,
    loading: false,
    hasError: false,
    refetch: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    selfCustodialEntries: mockSelfCustodialEntries,
    activeAccount: { id: "custodial-active", type: "custodial" },
    accounts: [],
    setActiveAccountId: jest.fn(),
    reloadSelfCustodialAccounts: jest.fn(),
  }),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  usePendingMigrationAccounts: () => ({
    pendingAccountIds: mockPendingAccountIds,
    pendingForActiveAccount: mockPendingForActiveAccount,
    savePendingAccount: jest.fn(),
    clearPendingAccount: jest.fn(),
    loading: false,
  }),
}))

const mockIsDeletionBlocked = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-migration-deletion-guard", () => ({
  useMigrationDeletionGuard: () => ({ isDeletionBlocked: mockIsDeletionBlocked }),
}))

/**
 * Stands in for the row so these tests stay about which wallets the switcher offers and
 * what it tells each row. The real row's own delete control, and its absence while
 * deletion is blocked, are proven against the real component in profile-row.spec.
 */
jest.mock("@app/screens/settings-screen/self-custodial/profile-row", () => ({
  ProfileRow: ({
    entry,
    isDeletionBlocked,
  }: {
    entry: { id: string }
    isDeletionBlocked: boolean
  }) => {
    const ReactActual = jest.requireActual("react")
    const { Text } = jest.requireActual("react-native")
    return ReactActual.createElement(
      Text,
      { testID: `sc-entry-${entry.id}` },
      isDeletionBlocked ? `${entry.id}:blocked` : entry.id,
    )
  },
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        authUrl: "https://api.blink.sv",
      },
      token: mockAppConfigToken,
    },
  }),
  useSaveSessionProfile: () => ({
    saveProfile: mockSaveProfile,
  }),
}))

describe("Settings", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
    mockAppConfigToken = "mock-token-1"
    mockSaveProfile.mockClear()
    mockSelfCustodialEntries = []
    mockPendingAccountIds = new Set()
    mockPendingForActiveAccount = null
    mockMigrationCompleted = false
    mockIsDeletionBlocked.mockReturnValue(false)
  })

  it("Switch account shows user profiles", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByText("TestUser")).toBeTruthy()
      expect(screen.getByTestId(LL.AccountScreen.switchAccount())).toBeTruthy()
    })

    expect(KeyStoreWrapper.getSessionProfiles).toHaveBeenCalled()
    const profiles = await KeyStoreWrapper.getSessionProfiles()
    expect(profiles).toEqual(expectedProfiles)
    expect(screen.getByTestId(LL.ProfileScreen.addAccount())).toBeTruthy()
  })

  it("shows stored custodial profiles even with no current token (self-custodial active)", async () => {
    mockAppConfigToken = ""
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByText("TestUser")).toBeTruthy()
    })
    expect(mockSaveProfile).not.toHaveBeenCalled()
  })

  it("saves the active custodial profile when a token is present and none are stored yet", async () => {
    mockAppConfigToken = "mock-token-1"
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(expectedProfiles)

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith("mock-token-1")
    })
  })

  it("hides wallets provisioned mid-migration from the switcher until activated", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [
      { id: "sc-pending-1", createdAt: 1 },
      { id: "sc-normal-1", createdAt: 2 },
    ]
    mockPendingAccountIds = new Set(["sc-pending-1"])

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-normal-1")).toBeTruthy()
    })
    expect(screen.queryByTestId("sc-entry-sc-pending-1")).toBeNull()
  })

  /**
   * The funds already left the custodial account for this wallet. Hiding it until the
   * automatic swap confirms the receive would strand them whenever that swap cannot finish,
   * so once the server completed the migration the user can switch to it themselves.
   */
  it("offers the migration's wallet once the server completed the migration", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [{ id: "sc-migrated-1", createdAt: 1 }]
    mockPendingAccountIds = new Set(["sc-migrated-1"])
    mockPendingForActiveAccount = "sc-migrated-1"
    mockMigrationCompleted = true

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-migrated-1")).toBeTruthy()
    })
  })

  it("keeps the migration's wallet hidden while the migration has not completed", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [
      { id: "sc-migrating-1", createdAt: 1 },
      { id: "sc-normal-1", createdAt: 2 },
    ]
    mockPendingAccountIds = new Set(["sc-migrating-1"])
    mockPendingForActiveAccount = "sc-migrating-1"
    mockMigrationCompleted = false

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-normal-1")).toBeTruthy()
    })
    expect(screen.queryByTestId("sc-entry-sc-migrating-1")).toBeNull()
  })

  /** Only the active account's own wallet: another profile's pending wallet belongs to a
   *  migration this account's completion says nothing about. */
  it("keeps another account's pending wallet hidden after this one completed", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [
      { id: "sc-migrated-1", createdAt: 1 },
      { id: "sc-other-pending-1", createdAt: 2 },
    ]
    mockPendingAccountIds = new Set(["sc-migrated-1", "sc-other-pending-1"])
    mockPendingForActiveAccount = "sc-migrated-1"
    mockMigrationCompleted = true

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-migrated-1")).toBeTruthy()
    })
    expect(screen.queryByTestId("sc-entry-sc-other-pending-1")).toBeNull()
  })

  /**
   * The wallet this PR admits into the switcher is reachable and undeletable at once: it
   * holds the only key to funds the server already moved out of the custodial account, so
   * the row it gets must be told not to offer removal.
   */
  it("tells the migration's newly offered wallet that deletion is blocked", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [{ id: "sc-migrated-1", createdAt: 1 }]
    mockPendingAccountIds = new Set(["sc-migrated-1"])
    mockPendingForActiveAccount = "sc-migrated-1"
    mockMigrationCompleted = true
    mockIsDeletionBlocked.mockImplementation(
      (accountId: string) => accountId === "sc-migrated-1",
    )

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-migrated-1")).toBeTruthy()
    })
    expect(screen.getByText("sc-migrated-1:blocked")).toBeTruthy()
    expect(mockIsDeletionBlocked).toHaveBeenCalledWith("sc-migrated-1")
  })

  /** The flag is per row, not per screen: an ordinary wallet beside a blocked one keeps
   *  its delete control. */
  it("asks the guard per wallet and leaves unrelated wallets deletable", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [
      { id: "sc-migrated-1", createdAt: 1 },
      { id: "sc-normal-1", createdAt: 2 },
    ]
    mockPendingAccountIds = new Set(["sc-migrated-1"])
    mockPendingForActiveAccount = "sc-migrated-1"
    mockMigrationCompleted = true
    mockIsDeletionBlocked.mockImplementation(
      (accountId: string) => accountId === "sc-migrated-1",
    )

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-sc-normal-1")).toBeTruthy()
    })
    expect(screen.getByText("sc-migrated-1:blocked")).toBeTruthy()
    expect(screen.getByText("sc-normal-1")).toBeTruthy()
  })

  it("keeps a pending wallet visible once it became the active account", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)
    mockSelfCustodialEntries = [{ id: "custodial-active", createdAt: 1 }]
    mockPendingAccountIds = new Set(["custodial-active"])

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("sc-entry-custodial-active")).toBeTruthy()
    })
  })
})

describe("fetchProfiles", () => {
  it("marks no profile as selected when there is no current token", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    const profiles = await fetchProfiles("")

    expect(profiles).toHaveLength(1)
    expect(profiles.some((profile) => profile.selected)).toBe(false)
  })

  it("marks only the profile whose token matches the current token as selected", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    const profiles = await fetchProfiles("mock-token-1")

    expect(profiles[0].selected).toBe(true)
  })
})
