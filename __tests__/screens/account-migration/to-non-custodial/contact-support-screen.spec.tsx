import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationContactSupportScreen } from "@app/screens/account-migration/to-non-custodial/contact-support-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const LLSupport = LL.AccountMigration.contactSupport
const SUPPORT_EMAIL = "feedback@blink.sv"
const LONG_PUBKEY = "0123456789abcdefghijklmnopqrst"

const mockSendSupportEmail = jest.fn()
let mockDetails = {
  accountId: "18A4242",
  pubKey: "spbc1pdjsovJFPej9i2vuK",
  username: "satoshin21",
  email: "email@email.com",
  phone: "+1 374 9383 993",
}

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationSupportDetails: () => mockDetails,
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-support-email", () => ({
  useMigrationSupportEmail: () => ({ sendSupportEmail: mockSendSupportEmail }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationContactSupportScreen />
    </ContextForScreen>,
  )

describe("MigrationContactSupportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockDetails = {
      accountId: "18A4242",
      pubKey: "spbc1pdjsovJFPej9i2vuK",
      username: "satoshin21",
      email: "email@email.com",
      phone: "+1 374 9383 993",
    }
  })

  it("redirects the hardware back to the commit point instead of exiting", async () => {
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("renders the hero, every diagnostics row and the contact action", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-headset")).toBeTruthy()
    expect(screen.getByText(LLSupport.title())).toBeTruthy()
    expect(screen.getByText(LLSupport.body())).toBeTruthy()
    expect(screen.getByText(LLSupport.accountIdLabel())).toBeTruthy()
    expect(screen.getByText("18A4242")).toBeTruthy()
    expect(screen.getByText(LLSupport.pubKeyLabel())).toBeTruthy()
    expect(screen.getByText("spbc1pdjsovJFPej9i2vuK")).toBeTruthy()
    expect(screen.getByText(LLSupport.usernameLabel())).toBeTruthy()
    expect(screen.getByText("satoshin21")).toBeTruthy()
    expect(screen.getByText(LLSupport.emailLabel())).toBeTruthy()
    expect(screen.getByText("email@email.com")).toBeTruthy()
    expect(screen.getByText(LLSupport.phoneLabel())).toBeTruthy()
    expect(screen.getByText("+1 374 9383 993")).toBeTruthy()
    expect(screen.getByText(LLSupport.contactUsCta())).toBeTruthy()
    // The support address is never shown on screen; it only receives the email.
    expect(screen.queryByText(SUPPORT_EMAIL)).toBeNull()
  })

  it("middle-ellipsizes the account id and the pubKey to a single line", async () => {
    const longAccountId = "0aa9dd75-4eaa-4bcd-9139-bb957c7c05e"
    mockDetails = { ...mockDetails, accountId: longAccountId, pubKey: LONG_PUBKEY }
    renderScreen()
    await flushEffects()

    expect(screen.getByText("0aa9dd75-4...b957c7c05e")).toBeTruthy()
    expect(screen.getByText("0123456789...klmnopqrst")).toBeTruthy()
  })

  it("hides the rows whose value is missing", async () => {
    mockDetails = { ...mockDetails, username: "", email: "" }
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LLSupport.usernameLabel())).toBeNull()
    expect(screen.queryByText(LLSupport.emailLabel())).toBeNull()
    expect(screen.getByText(LLSupport.phoneLabel())).toBeTruthy()
  })

  it("sends the support email from the contact action", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLSupport.contactUsCta()))

    expect(mockSendSupportEmail).toHaveBeenCalledTimes(1)
  })
})
