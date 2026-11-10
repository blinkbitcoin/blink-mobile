import React from "react"
import { Alert, AlertButton } from "react-native"

import { act, fireEvent, render } from "@testing-library/react-native"

import { LogOut } from "@app/screens/settings-screen/account/settings/logout"

const mockLogout = jest.fn()
const mockRouteAfterLogout = jest.fn()

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks/use-logout-and-route", () => ({
  useLogoutAndRoute: () => ({ routeAfterLogout: mockRouteAfterLogout }),
}))

jest.mock("@app/screens/settings-screen/account/login-methods-hook", () => ({
  useLoginMethods: () => ({
    phone: "+50312345678",
    email: undefined,
    emailVerified: false,
    bothEmailAndPhoneVerified: false,
  }),
}))

jest.mock("@app/screens/settings-screen/button", () => ({
  SettingsButton: ({ title, onPress }: { title: string; onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "logout-row" }, title),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountScreen: {
        logOutAndDeleteLocalData: () => "Log out",
        logoutAlertTitle: () => "Are you sure?",
        logoutAlertContentPhone: () => "phone content",
        logoutAlertContentEmail: () => "email content",
        logoutAlertContentPhoneEmail: () => "both content",
        IUnderstand: () => "I understand",
      },
      common: {
        cancel: () => "Cancel",
        loggedOut: () => "Logged out",
        ok: () => "OK",
      },
    },
  }),
}))

/** Both steps of the logout are Alert buttons, so the spy has to hand them back rather than
 *  just record that an alert happened. */
const alertCalls: Array<{ title: string; body?: string; buttons?: AlertButton[] }> = []

const pressAlertButton = async (call: number, label: string) => {
  const button = alertCalls[call]?.buttons?.find((candidate) => candidate.text === label)
  await act(async () => {
    await button?.onPress?.()
  })
}

describe("LogOut", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    alertCalls.length = 0
    mockLogout.mockResolvedValue({ isAppLockKept: false })
    jest
      .spyOn(Alert, "alert")
      .mockImplementation((title, body, buttons) =>
        alertCalls.push({ title, body, buttons }),
      )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("asks for confirmation before signing out", () => {
    const { getByTestId } = render(<LogOut />)

    fireEvent.press(getByTestId("logout-row"))

    expect(alertCalls).toHaveLength(1)
    expect(alertCalls[0].title).toBe("Are you sure?")
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it("signs out of nothing when the confirmation is cancelled", async () => {
    const { getByTestId } = render(<LogOut />)
    fireEvent.press(getByTestId("logout-row"))

    await pressAlertButton(0, "Cancel")

    expect(mockLogout).not.toHaveBeenCalled()
  })

  /**
   * The route is the logout's to decide, not this screen's: a lock kept because the device
   * still stores a wallet is owed an answer, and resetting straight to the landing screen
   * from here is what used to walk that lock away.
   */
  it("leaves the way out to the shared logout route, carrying the logout's answer", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: true })
    const { getByTestId } = render(<LogOut />)
    fireEvent.press(getByTestId("logout-row"))

    await pressAlertButton(0, "I understand")
    await pressAlertButton(1, "OK")

    expect(mockRouteAfterLogout).toHaveBeenCalledWith(true)
  })

  it("passes a dropped lock through as well", async () => {
    mockLogout.mockResolvedValue({ isAppLockKept: false })
    const { getByTestId } = render(<LogOut />)
    fireEvent.press(getByTestId("logout-row"))

    await pressAlertButton(0, "I understand")
    await pressAlertButton(1, "OK")

    expect(mockRouteAfterLogout).toHaveBeenCalledWith(false)
  })

  /**
   * The gate raises a biometric prompt the moment it opens, so an alert left to fire over
   * it would cover the only thing the user can answer. The farewell is acknowledged first
   * and the route is taken from its own callback.
   */
  it("says goodbye before routing, never after", async () => {
    const { getByTestId } = render(<LogOut />)
    fireEvent.press(getByTestId("logout-row"))

    await pressAlertButton(0, "I understand")

    expect(alertCalls).toHaveLength(2)
    expect(alertCalls[1].title).toBe("Logged out")
    expect(mockRouteAfterLogout).not.toHaveBeenCalled()

    await pressAlertButton(1, "OK")

    expect(mockRouteAfterLogout).toHaveBeenCalledTimes(1)
  })
})
