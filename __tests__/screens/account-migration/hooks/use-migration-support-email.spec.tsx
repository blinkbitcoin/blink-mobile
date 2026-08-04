import React from "react"
import { Linking } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { useMigrationSupportEmail } from "@app/screens/account-migration/hooks/use-migration-support-email"
import { MigrationSupportReason } from "@app/types/migration"

loadLocale("en")
const LL = i18nObject("en")
const LLSupport = LL.AccountMigration.contactSupport
const SUPPORT_EMAIL = "support@blink.sv"
const APP_VERSION = "1.2.3-test"
const DIVIDER = "-".repeat(40)

let mockDetails = {
  accountId: "18A4242",
  pubKey: "02abc123pubkey",
  username: "satoshin21",
  email: "email@email.com",
  phone: "+1 374 9383 993",
}
let mockCountryCode: string | undefined = "SV"
let mockIsIos = true

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  get isIos() {
    return mockIsIos
  },
}))

jest.mock("@app/screens/account-migration/hooks/use-migration-support-details", () => ({
  useMigrationSupportDetails: () => mockDetails,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => ({ supportEmailAddress: "support@blink.sv" }),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({
    countryCode: mockCountryCode,
    loading: false,
    detectionFailed: false,
    source: "phone",
  }),
}))

jest.mock("react-native-device-info", () => ({
  __esModule: true,
  getReadableVersion: () => "1.2.3-test",
  default: { getReadableVersion: () => "1.2.3-test" },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TypesafeI18n locale="en">{children}</TypesafeI18n>
)

const expectedMailto = (body: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    LLSupport.emailSubject(),
  )}&body=${encodeURIComponent(body)}`

describe("useMigrationSupportEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockDetails = {
      accountId: "18A4242",
      pubKey: "02abc123pubkey",
      username: "satoshin21",
      email: "email@email.com",
      phone: "+1 374 9383 993",
    }
    mockCountryCode = "SV"
    mockIsIos = true
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve())
  })

  it("opens the structured support email with the full diagnostics", async () => {
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.TransferFailed),
      {
        wrapper,
      },
    )

    await act(async () => {
      result.current.sendSupportEmail()
    })

    const expectedBody = [
      LLSupport.emailAccountInfo(),
      DIVIDER,
      `${LLSupport.reasonLabel()}: transfer-failed`,
      `${LLSupport.accountIdLabel()}: 18A4242`,
      `${LLSupport.pubKeyLabel()}: 02abc123pubkey`,
      `${LLSupport.usernameLabel()}: satoshin21`,
      `${LLSupport.emailLabel()}: email@email.com`,
      `${LLSupport.phoneLabel()}: +1 374 9383 993`,
      `${LLSupport.platformLabel()}: iOS`,
      `${LLSupport.appVersionLabel()}: ${APP_VERSION}`,
      `${LLSupport.countryLabel()}: SV`,
      DIVIDER,
      "",
      LLSupport.emailDescribeProblem(),
      "",
    ].join("\n")
    expect(Linking.openURL).toHaveBeenCalledWith(expectedMailto(expectedBody))
  })

  it("skips the empty diagnostics and the country when they are unavailable", async () => {
    mockDetails = { ...mockDetails, username: "", email: "" }
    mockCountryCode = undefined
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.TransferFailed),
      {
        wrapper,
      },
    )

    await act(async () => {
      result.current.sendSupportEmail()
    })

    const expectedBody = [
      LLSupport.emailAccountInfo(),
      DIVIDER,
      `${LLSupport.reasonLabel()}: transfer-failed`,
      `${LLSupport.accountIdLabel()}: 18A4242`,
      `${LLSupport.pubKeyLabel()}: 02abc123pubkey`,
      `${LLSupport.phoneLabel()}: +1 374 9383 993`,
      `${LLSupport.platformLabel()}: iOS`,
      `${LLSupport.appVersionLabel()}: ${APP_VERSION}`,
      DIVIDER,
      "",
      LLSupport.emailDescribeProblem(),
      "",
    ].join("\n")
    expect(Linking.openURL).toHaveBeenCalledWith(expectedMailto(expectedBody))
  })

  /** The reason no longer travels with the account diagnostics, so it has to survive a
   *  device that can supply none of them. */
  it("carries the reason even when every account detail is missing", () => {
    mockDetails = { accountId: "", pubKey: "", username: "", email: "", phone: "" }
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.StartRefused),
      { wrapper },
    )

    result.current.sendSupportEmail()

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent(`${LLSupport.reasonLabel()}: start-refused`),
      ),
    )
  })

  it("labels the platform as Android on non-iOS devices", async () => {
    mockIsIos = false
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.TransferFailed),
      {
        wrapper,
      },
    )

    await act(async () => {
      result.current.sendSupportEmail()
    })

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent(`${LLSupport.platformLabel()}: Android`),
      ),
    )
  })

  /** The card shows what failed then who the user is, and stops there: the environment
   *  metadata is only for the email and the clipboard. */
  it("exposes the card details with the reason first and no environment metadata", () => {
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.TransferFailed),
      { wrapper },
    )

    expect(result.current.cardDetails).toEqual([
      { label: LLSupport.reasonLabel(), value: "transfer-failed", isIdentifier: false },
      { label: LLSupport.accountIdLabel(), value: "18A4242", isIdentifier: true },
      { label: LLSupport.pubKeyLabel(), value: "02abc123pubkey", isIdentifier: true },
      { label: LLSupport.usernameLabel(), value: "satoshin21", isIdentifier: false },
      { label: LLSupport.emailLabel(), value: "email@email.com", isIdentifier: false },
      { label: LLSupport.phoneLabel(), value: "+1 374 9383 993", isIdentifier: false },
    ])
  })

  /** The copyable block is the full support payload the email sends, so the two never drift. */
  it("exposes the copyable block matching the email with the environment appended", () => {
    const { result } = renderHook(
      () => useMigrationSupportEmail(MigrationSupportReason.TransferFailed),
      { wrapper },
    )

    expect(result.current.supportDetailsText).toBe(
      [
        `${LLSupport.reasonLabel()}: transfer-failed`,
        `${LLSupport.accountIdLabel()}: 18A4242`,
        `${LLSupport.pubKeyLabel()}: 02abc123pubkey`,
        `${LLSupport.usernameLabel()}: satoshin21`,
        `${LLSupport.emailLabel()}: email@email.com`,
        `${LLSupport.phoneLabel()}: +1 374 9383 993`,
        `${LLSupport.platformLabel()}: iOS`,
        `${LLSupport.appVersionLabel()}: ${APP_VERSION}`,
        `${LLSupport.countryLabel()}: SV`,
      ].join("\n"),
    )
  })
})
