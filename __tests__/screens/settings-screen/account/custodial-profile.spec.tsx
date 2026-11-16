import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { ProfileScreen } from "@app/screens/settings-screen/account/multi-account/profile"

import { ContextForScreen } from "../../helper"

const mockNavigate = jest.fn()
const mockPopTo = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    popTo: mockPopTo,
    dispatch: jest.fn(),
  }),
}))

const mockSaveToken = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ saveToken: mockSaveToken }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: jest.fn() }),
}))

/** The logout route reaches the lock context, which pulls in native boot code; a switch
 *  never logs out, so only the import has to load. */
jest.mock("@app/hooks/use-logout-and-route", () => ({
  useLogoutAndRoute: () => ({ logoutAndRoute: jest.fn() }),
}))

const mockSetActiveAccountId = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: { id: "self-custodial-active", type: "self-custodial" },
    setActiveAccountId: mockSetActiveAccountId,
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

describe("ProfileScreen (custodial row on Switch account)", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
  })

  /** Back to the Home already on the stack: `navigate` would push another one on top of
   *  Switch account, and every switch would grow the stack by one. */
  it("pops back to Home when switching to the profile", async () => {
    render(
      <ContextForScreen>
        <ProfileScreen
          identifier="TestUser"
          token="mock-token-1"
          selected={false}
          lnAddressHostname="blink.sv"
        />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId(LL.AccountScreen.switchAccount()))
    })

    expect(mockSaveToken).toHaveBeenCalledWith("mock-token-1")
    expect(mockPopTo).toHaveBeenCalledWith("Primary")
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
