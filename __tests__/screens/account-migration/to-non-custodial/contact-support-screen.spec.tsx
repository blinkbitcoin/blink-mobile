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
const mockSupportEmail = "feedback@blink.sv"
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
const mockSetOptions = jest.fn()
let mockOrigin: MigrationSupportOrigin | undefined
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
  useRoute: () => ({
    params: mockHasParams ? { reason: mockReason, origin: mockOrigin } : undefined,
  }),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ supportEmailAddress: mockSupportEmail }),
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

const MOCK_SUPPORT_DETAILS_TEXT = "reason and identity and environment block"

const mockUseMigrationSupportEmail = jest.fn((reason: string) => ({
  cardDetails: [
    { label: LLSupport.reasonLabel(), value: reason, isIdentifier: false },
    ...mockBuildDiagnostics(),
  ],
  supportDetailsText: MOCK_SUPPORT_DETAILS_TEXT,
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

  /** The back control lives in the navigator header, set from this screen so it reuses the
   *  return path to the commit point rather than a blind goBack. */
  it("returns to the commit point from the header back control", async () => {
    renderScreen()
    await flushEffects()

    const options = mockSetOptions.mock.calls.at(-1)?.[0]
    options?.headerLeft?.().props.onPress()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  /** From the resume handover there is no commit screen underneath, so the hardware back
   *  dismisses rather than pushing a fresh one that would re-arm a completed migration and
   *  overwrite the reason. */
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

  it("dismisses the header back when opened from the resume handover", async () => {
    mockOrigin = MigrationSupportOrigin.Resume
    renderScreen()
    await flushEffects()

    const options = mockSetOptions.mock.calls.at(-1)?.[0]
    options?.headerLeft?.().props.onPress()

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("renders the hero, every diagnostics row and the contact action", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-headset")).toBeTruthy()
    expect(screen.getByText(LLSupport.title())).toBeTruthy()
    expect(screen.getByText(LLSupport.body())).toBeTruthy()
    expect(screen.getByText(LLSupport.reasonLabel())).toBeTruthy()
    expect(screen.getByText("preview-unavailable")).toBeTruthy()
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
    // The support address is shown as the copy control's label.
    expect(screen.getByText(mockSupportEmail)).toBeTruthy()
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

  /** Lukas's rule: the error screen is the support channel, so what failed is on the screen,
   *  the reason code included, not just in the email. */
  it("shows the reason code on the screen", async () => {
    mockReason = MigrationSupportReason.SelfCustodialAccountMissing
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LLSupport.reasonLabel())).toBeTruthy()
    expect(screen.getByText("self-custodial-account-missing")).toBeTruthy()
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

  /** Tapping the support address copies it, so a user whose mail app the Contact us button
   *  cannot open can still paste the address into their own. */
  it("copies the support address to the clipboard", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-contact-support-copy"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: mockSupportEmail })
  })

  /** The copy control puts the full support block (what the email sends) on the clipboard,
   *  so a user can paste it into their own message to support. */
  it("copies the full support block to the clipboard", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLSupport.copy()))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content: MOCK_SUPPORT_DETAILS_TEXT,
    })
  })
})
