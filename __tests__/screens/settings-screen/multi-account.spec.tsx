import React from "react"
import { render, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SwitchAccountComponent } from "@app/screens/settings-screen/account/multi-account/switch-account.stories"
import { fetchProfiles } from "@app/screens/settings-screen/account/multi-account/utils"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { ContextForScreen } from "../helper"

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
    pendingForActiveAccount: null,
    savePendingAccount: jest.fn(),
    clearPendingAccount: jest.fn(),
    loading: false,
  }),
}))

jest.mock("@app/screens/settings-screen/self-custodial/profile-row", () => ({
  ProfileRow: ({ entry }: { entry: { id: string } }) => {
    const ReactActual = jest.requireActual("react")
    const { Text } = jest.requireActual("react-native")
    return ReactActual.createElement(Text, { testID: `sc-entry-${entry.id}` }, entry.id)
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
