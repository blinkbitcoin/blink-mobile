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
const mockReset = jest.fn()
let mockOrigin: MigrationSupportOrigin | undefined
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
    reset: mockReset,
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
    },
    { label: LLSupport.pubKeyLabel(), value: mockDetails.pubKey },
    {
      label: LLSupport.usernameLabel(),
      value: mockDetails.username,
    },
    { label: LLSupport.emailLabel(), value: mockDetails.email },
    { label: LLSupport.phoneLabel(), value: mockDetails.phone },
  ].filter((diagnostic) => Boolean(diagnostic.value))

jest.mock("@app/screens/account-migration/hooks/use-migration-support-email", () => ({
  useMigrationSupportEmail: (reason: string) => mockUseMigrationSupportEmail(reason),
}))

const MOCK_SUPPORT_DETAILS_TEXT = "reason and identity and environment block"

const mockUseMigrationSupportEmail = jest.fn((reason: string) => ({
  cardDetails: [
    { label: LLSupport.reasonLabel(), value: reason },
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

  /** From the gate handover (a lock with nothing to resume, #4070) there is nothing behind
   *  this screen: the gate underneath would only replay the handover, and the commit path
   *  would fabricate a commit screen for an account with no provisioned wallet. Support is
   *  terminal, so the hardware back is swallowed without navigating anywhere. */
  it("swallows the hardware back when opened from the gate handover", async () => {
    mockOrigin = MigrationSupportOrigin.Gate
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("hides the header back control when opened from the gate handover", async () => {
    mockOrigin = MigrationSupportOrigin.Gate
    renderScreen()
    await flushEffects()

    const options = mockSetOptions.mock.calls.at(-1)?.[0]

    expect(options?.headerLeft?.()).toBeNull()
  })

  /** A null headerLeft is not enough on native-stack: without headerBackVisible false the
   *  navigator falls back to its native back button, which popped this cohort onto the
   *  gate's spent spinner (caught on-device while demoing #4070). */
  it("suppresses the native back button so null headerLeft cannot fall back to it", async () => {
    mockOrigin = MigrationSupportOrigin.Gate
    renderScreen()
    await flushEffects()

    const options = mockSetOptions.mock.calls.at(-1)?.[0]

    expect(options?.headerBackVisible).toBe(false)
  })

  /** The gate handover's ticket is identified by its code alone (support greps for it),
   *  so the screen has to show `locked-without-checkpoint` verbatim for the cohort a
   *  screenshot is the only diagnostic from. */
  it("shows the gate handover's reason code verbatim", async () => {
    mockReason = MigrationSupportReason.LockedWithoutCheckpoint
    mockOrigin = MigrationSupportOrigin.Gate
    renderScreen()
    await flushEffects()

    expect(screen.getByText(LLSupport.reasonLabel())).toBeTruthy()
    expect(screen.getByText("locked-without-checkpoint")).toBeTruthy()
    expect(mockUseMigrationSupportEmail).toHaveBeenCalledWith("locked-without-checkpoint")
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

  /** A refused start can clear itself without support: the start latch is in-memory, so the
   *  screen offers a retry instead of the support-first copy (#4098). The diagnostics stay:
   *  support still needs the reason code and identity if the retry does not help. */
  it("shows the self-help copy for a refused start", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-refresh")).toBeTruthy()
    expect(screen.getByText(LLSupport.selfHelp.title())).toBeTruthy()
    expect(screen.getByText(LLSupport.selfHelp.body())).toBeTruthy()
    // No queryByText(LLSupport.title()) here: "Contact support" is also the demoted
    // control's label, so the generic hero's absence is asserted through its body instead.
    expect(screen.queryByText(LLSupport.body())).toBeNull()
    expect(screen.queryByText(LLSupport.contactUsCta())).toBeNull()
    expect(screen.getByText(LLSupport.reasonLabel())).toBeTruthy()
    expect(screen.getByText("start-refused")).toBeTruthy()
    // The diagnostics card and its copy control survive the variant switch: the users
    // still stuck after a retry are exactly the ones support needs the identity from.
    expect(screen.getByText(LLSupport.accountIdLabel())).toBeTruthy()
    expect(screen.getByText("18A4242")).toBeTruthy()
    expect(screen.getByText(LLSupport.pubKeyLabel())).toBeTruthy()
    expect(screen.getByText(LLSupport.copy())).toBeTruthy()
  })

  /**
   * The retry is the whole point of the variant: it has to unmount the commit screen holding
   * the settled refusal, which a plain navigate would leave in place to re-route straight back
   * here. It resets to the entry dispatcher rather than a migration screen so the
   * resume-vs-fresh decision and the kill-switch still run, with Primary underneath so the
   * user is not stranded.
   */
  it("restarts the migration from the entry dispatcher", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-contact-support-retry"))

    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: "Primary" }, { name: "accountMigrationEntry" }],
    })
    expect(mockSendSupportEmail).not.toHaveBeenCalled()
  })

  /** Support is demoted, not removed: the secondary still reaches the same pre-filled email. */
  it("reaches support from the demoted self-help contact action", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLSupport.selfHelp.contactSupportCta()))

    expect(mockSendSupportEmail).toHaveBeenCalledTimes(1)
    expect(mockReset).not.toHaveBeenCalled()
  })

  /** The footer takes one primary and one secondary, so the self-help variant spends its
   *  secondary on support and drops the address-as-copy-control the support-first variant
   *  keeps. The full block is still copyable from the card's own control. */
  it("drops the address copy control in the self-help variant", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    expect(screen.queryByTestId("migration-contact-support-copy")).toBeNull()
    expect(screen.queryByText(mockSupportEmail)).toBeNull()
    expect(screen.getByText(LLSupport.copy())).toBeTruthy()
  })

  /** The support-first footer is unchanged: contact primary, address secondary, no retry. */
  it("keeps the established footer for a support-first reason", async () => {
    mockReason = MigrationSupportReason.LockedWithoutCheckpoint
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("migration-contact-support-cta")).toBeTruthy()
    expect(screen.getByTestId("migration-contact-support-copy")).toBeTruthy()
    expect(screen.queryByTestId("migration-contact-support-retry")).toBeNull()
  })

  /** Terminal reasons cannot be restarted away, so they keep the support-first copy;
   *  the self-help variant is scoped to the restart-resolvable set alone. */
  it("keeps the support-first copy for a terminal reason", async () => {
    mockReason = MigrationSupportReason.LockedWithoutCheckpoint
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-headset")).toBeTruthy()
    expect(screen.getByText(LLSupport.title())).toBeTruthy()
    expect(screen.getByText(LLSupport.body())).toBeTruthy()
    expect(screen.getByText(LLSupport.contactUsCta())).toBeTruthy()
    expect(screen.queryByText(LLSupport.selfHelp.title())).toBeNull()
  })

  /**
   * Which reasons get the self-help variant IS the feature, so the whole taxonomy is
   * enumerated rather than sampled: adding a reason to RESTART_RESOLVABLE_REASONS without
   * deciding it belongs there fails here instead of shipping restart advice for a failure a
   * restart cannot clear. Every reason present in the enum is covered by construction, so a
   * new one has to be classified before this passes.
   */
  describe("variant membership across every support reason", () => {
    const RESTART_RESOLVABLE: MigrationSupportReason[] = [
      MigrationSupportReason.StartRefused,
    ]
    const allReasons: MigrationSupportReason[] = Object.values(MigrationSupportReason)

    allReasons.forEach((reason) => {
      const expectsSelfHelp = RESTART_RESOLVABLE.includes(reason)
      const variant = expectsSelfHelp ? "self-help" : "support-first"

      it(`gives ${reason} the ${variant} copy`, async () => {
        mockReason = reason
        renderScreen()
        await flushEffects()

        expect(
          screen.getByTestId(expectsSelfHelp ? "icon-refresh" : "icon-headset"),
        ).toBeTruthy()
        expect(
          screen.queryByText(
            expectsSelfHelp ? LLSupport.selfHelp.body() : LLSupport.body(),
          ),
        ).toBeTruthy()
        expect(
          screen.queryByText(
            expectsSelfHelp ? LLSupport.body() : LLSupport.selfHelp.body(),
          ),
        ).toBeNull()
      })
    })
  })

  /** The variant switch restructured the JSX around the copy control, so the self-help
   *  variant asserts the press, not only the label: the still-stuck users are exactly the
   *  ones who need the block on their clipboard. */
  it("copies the full support block from the self-help variant", async () => {
    mockReason = MigrationSupportReason.StartRefused
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LLSupport.copy()))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content: MOCK_SUPPORT_DETAILS_TEXT,
    })
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

  /** The error screen is the support channel, so what failed is on the screen,
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
    // The fallback must never read as self-help: a restart is not a known remedy for a
    // reason we could not identify, so the stranded user gets the support-first framing.
    expect(screen.getByTestId("icon-headset")).toBeTruthy()
    expect(screen.queryByText(LLSupport.selfHelp.title())).toBeNull()
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
