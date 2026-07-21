import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationContactSupportScreen } from "@app/screens/account-migration/to-non-custodial/contact-support-screen"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
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

let mockReason: MigrationSupportReason = MigrationSupportReason.PreviewUnavailable
let mockHasParams = true

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockOrigin: MigrationSupportOrigin | undefined
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: mockHasParams ? { reason: mockReason, origin: mockOrigin } : undefined,
  }),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
}))

/** Mirrors useMigrationDiagnostics' shape, built from mockDetails at render time. */
const mockBuildDiagnostics = () =>
  [
    {
      label: LLSupport.accountIdLabel(),
      value: mockDetails.accountId,
      isIdentifier: true,
    },
    { label: LLSupport.pubKeyLabel(), value: mockDetails.pubKey, isIdentifier: true },
    {
      label: LLSupport.usernameLabel(),
      value: mockDetails.username,
      isIdentifier: false,
    },
    { label: LLSupport.emailLabel(), value: mockDetails.email, isIdentifier: false },
    { label: LLSupport.phoneLabel(), value: mockDetails.phone, isIdentifier: false },
  ].filter((diagnostic) => Boolean(diagnostic.value))

jest.mock("@app/screens/account-migration/hooks/use-migration-support-email", () => ({
  useMigrationSupportEmail: (reason: string) => mockUseMigrationSupportEmail(reason),
}))

const mockUseMigrationSupportEmail = jest.fn((_reason: string) => ({
  diagnostics: mockBuildDiagnostics(),
  sendSupportEmail: mockSendSupportEmail,
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
    mockReason = MigrationSupportReason.PreviewUnavailable
    mockHasParams = true
    mockOrigin = undefined
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

  it("returns to the commit point from the visible Back button (iOS has no hardware back)", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.back()))

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  /** From the resume handover there is no commit screen underneath, so Back dismisses rather
   *  than pushing a fresh one that would re-arm a completed migration and overwrite the reason. */
  it("dismisses the hardware back when opened from the resume handover", async () => {
    mockOrigin = MigrationSupportOrigin.Resume
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("dismisses the visible Back button when opened from the resume handover", async () => {
    mockOrigin = MigrationSupportOrigin.Resume
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.common.back()))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationBalancesOverview")
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

  /** Sensitive identifiers are shown complete for support to copy: the account id and the
   *  pubKey are never middle-ellipsized to fit one line. */
  it("renders the account id and the pubKey complete, never truncated", async () => {
    const longAccountId = "0aa9dd75-4eaa-4bcd-9139-bb957c7c05e"
    mockDetails = { ...mockDetails, accountId: longAccountId, pubKey: LONG_PUBKEY }
    renderScreen()
    await flushEffects()

    expect(screen.getByText(longAccountId)).toBeTruthy()
    expect(screen.getByText(LONG_PUBKEY)).toBeTruthy()
    expect(screen.queryByText("0aa9dd75-4...b957c7c05e")).toBeNull()
    expect(screen.queryByText("0123456789...klmnopqrst")).toBeNull()
  })

  it("hides the rows whose value is missing", async () => {
    mockDetails = { ...mockDetails, username: "", email: "" }
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LLSupport.usernameLabel())).toBeNull()
    expect(screen.queryByText(LLSupport.emailLabel())).toBeNull()
    expect(screen.getByText(LLSupport.phoneLabel())).toBeTruthy()
  })

  /** The reason is what tells support WHAT failed, so it reaches the email builder from
   *  the route rather than being guessed on this screen. */
  it("passes the route's reason through to the support email", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    expect(mockUseMigrationSupportEmail).toHaveBeenCalledWith("start-refused")
  })

  /** The screen shows identity for the user to copy; the reason is a code for support
   *  and travels in the email body instead. */
  it("keeps the reason code off the screen", async () => {
    mockReason = MigrationSupportReason.SelfCustodialAccountMissing
    renderScreen()
    await flushEffects()

    expect(screen.queryByText(LLSupport.reasonLabel())).toBeNull()
    expect(screen.queryByText("self-custodial-account-missing")).toBeNull()
  })

  /** A navigation-state restore can land here with no params; a named fallback keeps the
   *  ticket meaningful instead of crashing on the screen a stranded user was handed. */
  it("falls back to an unknown reason when the screen is reached without params", async () => {
    mockHasParams = false
    renderScreen()
    await flushEffects()

    expect(mockUseMigrationSupportEmail).toHaveBeenCalledWith("unknown")
  })

  it("sends the support email from the contact action", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLSupport.contactUsCta()))

    expect(mockSendSupportEmail).toHaveBeenCalledTimes(1)
  })
})
