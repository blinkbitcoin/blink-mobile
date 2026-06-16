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
