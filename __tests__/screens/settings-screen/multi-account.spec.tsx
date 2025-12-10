import React from "react"
import { render, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SwitchAccountComponent } from "@app/screens/settings-screen/account/multi-account/switch-account.stories"
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

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        authUrl: "https://api.blink.sv",
      },
      token: "mock-token-1",
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
})
