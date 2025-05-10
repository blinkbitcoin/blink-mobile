import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SwitchAccountComponent } from "@app/screens/settings-screen/settings/multi-account/switch-account.stories"
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

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        authUrl: "https://api.blink.sv",
      },
    },
  }),
  useSaveSessionProfile: () => ({
    saveProfile: jest.fn(),
  }),
}))

describe("Settings", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders switch account row", async () => {
    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    expect(screen.getByText(LL.AccountScreen.switchAccount())).toBeTruthy()
  })

  it("SwitchAccount expands and shows user profiles", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    const switchBtn = screen.getByText(LL.AccountScreen.switchAccount())
    fireEvent.press(switchBtn)

    await waitFor(() => {
      expect(screen.getByText("TestUser")).toBeTruthy()
    })

    expect(KeyStoreWrapper.getSessionProfiles).toHaveBeenCalled()
    const profiles = await KeyStoreWrapper.getSessionProfiles()
    expect(profiles).toEqual(expectedProfiles)
  })

  it("renders add account button when profiles are loaded", async () => {
    ;(KeyStoreWrapper.getSessionProfiles as jest.Mock).mockResolvedValue(expectedProfiles)

    const { getByText } = render(
      <ContextForScreen>
        <SwitchAccountComponent />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.AccountScreen.switchAccount()))

    await waitFor(() => {
      expect(getByText(LL.ProfileScreen.addAccount())).toBeTruthy()
    })
  })
})
