import React from "react"
import { StyleSheet } from "react-native"
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
let mockActiveAccount = { id: "self-custodial-active", type: "self-custodial" }
jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    accounts: [],
    activeAccount: mockActiveAccount,
    setActiveAccountId: mockSetActiveAccountId,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

describe("ProfileScreen (custodial row on Switch account)", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount = { id: "self-custodial-active", type: "self-custodial" }
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

  /** A 20dp circle with no touch padding read too small for a destructive action, and a
   *  near miss landed on the row and switched account. The 48dp box takes its 8dp each
   *  side back as margin, so the row lays it out at the circle's 32dp. */
  it("draws the remove button as a 32dp circle in a 48dp touch box", () => {
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
    const style = StyleSheet.flatten(screen.getByTestId("close").props.style)

    expect(style).toMatchObject({
      width: 48,
      height: 48,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
      margin: -8,
    })
  })

  it("asks to log out without switching account when the remove button is pressed", () => {
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

    fireEvent.press(screen.getByTestId("close"))

    expect(screen.getByText(LL.ProfileScreen.fromThisDevice())).toBeTruthy()
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
  })

  /** The identifier is the account's username or phone number, and the toast's message is
   *  logged to analytics: it is handed over as private so only the device shows it. */
  it("keeps the removed account's identifier out of analytics", async () => {
    mockActiveAccount = { id: "custodial", type: "custodial" }
    render(
      <ContextForScreen>
        <ProfileScreen
          identifier="TestUser"
          token="mock-token-1"
          nextProfileToken="mock-token-2"
          selected={true}
          lnAddressHostname="blink.sv"
        />
      </ContextForScreen>,
    )

    fireEvent.press(screen.getByTestId("close"))
    await act(async () => {
      fireEvent.press(screen.getByText(LL.common.confirm()))
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: LL.ProfileScreen.removedAccount({ identifier: "TestUser" }),
        privateValues: ["TestUser"],
      }),
    )
  })
})
