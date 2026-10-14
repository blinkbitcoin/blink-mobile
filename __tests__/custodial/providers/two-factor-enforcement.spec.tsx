import React from "react"
import { act, renderHook } from "@testing-library/react-native"

import {
  TwoFactorEnforcementProvider,
  useTwoFactorEnforcement,
} from "@app/custodial/providers/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"
import { AccountType } from "@app/types/wallet"

const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

let mockAccountType: AccountType = AccountType.Custodial
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockAccountType } }),
}))

let mockEnforcementEnabled = true
jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    custodialTwoFactorEnforcementEnabled: mockEnforcementEnabled,
  }),
}))

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: string[]) => mockGetItem(...args),
  setItem: (...args: string[]) => mockSetItem(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const ACCOUNT_ID = "custodial-account-1"
const PHONE = "+10000000000"
const EMAIL = "someone@example.com"
const storageKeyFor = (accountId: string) => `twoFactorEnforcement:${accountId}`

const walletsWith = (sats: number, usdCents: number) => [
  { id: "btc-wallet", walletCurrency: "BTC", balance: sats },
  { id: "usd-wallet", walletCurrency: "USD", balance: usdCents },
]

type MeEmail = { address: string | null; verified: boolean | null }

const verifiedEmail: MeEmail = { address: EMAIL, verified: true }
const unverifiedEmail: MeEmail = { address: EMAIL, verified: false }

type MeOverrides = {
  accountId?: string
  phone?: string | null
  email?: MeEmail | null
  totpEnabled?: boolean
  sats?: number
  usdCents?: number
}

const setAccount = ({
  accountId = ACCOUNT_ID,
  phone = null,
  email = null,
  totpEnabled = false,
  sats = 0,
  usdCents = 0,
}: MeOverrides = {}) => {
  mockUseSettingsScreenQuery.mockReturnValue({
    data: {
      me: {
        id: "user-1",
        phone,
        email,
        totpEnabled,
        defaultAccount: { id: accountId, wallets: walletsWith(sats, usdCents) },
      },
    },
  })
}

const storeRecord = (record: {
  highestTier: TwoFactorTier
  nudgeCardDismissed: boolean
}) => mockGetItem.mockResolvedValue(JSON.stringify(record))

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <TwoFactorEnforcementProvider>{children}</TwoFactorEnforcementProvider>
)

const renderEnforcement = async () => {
  const rendered = renderHook(() => useTwoFactorEnforcement(), { wrapper })
  await act(async () => {})
  return rendered
}

describe("TwoFactorEnforcementProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnforcementEnabled = true
    mockIsAuthed = true
    mockAccountType = AccountType.Custodial
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
    setAccount({ sats: 50_000 })
  })

  describe("gating", () => {
    it("is inert without a provider", () => {
      const { result } = renderHook(() => useTwoFactorEnforcement())

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      act(() => result.current.dismissNudgeCard())
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("shows nothing while the flag is off", async () => {
      mockEnforcementEnabled = false

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("shows nothing until the account's record has loaded", () => {
      mockGetItem.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("ignores a self-custodial account even when the query still answers", async () => {
      mockAccountType = AccountType.SelfCustodial

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(mockGetItem).not.toHaveBeenCalled()
    })

    it("ignores a logged-out session even when the query still answers", async () => {
      mockIsAuthed = false

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockGetItem).not.toHaveBeenCalled()
    })

    it("shows nothing without an account", async () => {
      mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockGetItem).not.toHaveBeenCalled()
    })
  })

  describe("tiers", () => {
    it("stays quiet below the nudge threshold", async () => {
      setAccount({ sats: 49_999, usdCents: 4_999 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("shows the card and the banner at the nudge tier without two factors", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Nudge)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("reaches the tier from the dollar wallet alone", async () => {
      setAccount({ usdCents: 5_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Nudge)
    })

    it("keeps the banner at the required tier", async () => {
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("drops the banner but keeps the card at the authenticator tier", async () => {
      setAccount({ sats: 5_000_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Authenticator)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("keeps the highest tier the account ever reached", async () => {
      setAccount({ sats: 0 })
      storeRecord({ highestTier: TwoFactorTier.Required, nudgeCardDismissed: false })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("stores the tier the moment the balance crosses a higher threshold", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(mockSetItem).toHaveBeenCalledWith(
        storageKeyFor(ACCOUNT_ID),
        JSON.stringify({ highestTier: TwoFactorTier.Required, nudgeCardDismissed: true }),
      )
    })

    it("does not rewrite a tier the record already holds", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: false })

      await renderEnforcement()

      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })

  describe("factors", () => {
    it("never prompts an account with a phone and a verified email", async () => {
      setAccount({ sats: 500_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(true)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("counts the authenticator as a second factor", async () => {
      setAccount({ sats: 500_000, phone: PHONE, totpEnabled: true })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(true)
      expect(result.current.shouldShowNudgeCard).toBe(false)
    })

    it("does not count an unverified email and hands its address to the setup", async () => {
      setAccount({ sats: 50_000, phone: PHONE, email: unverifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(false)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(result.current.missingMethod).toBe(TwoFactorMethod.Email)
      expect(result.current.unverifiedEmail).toBe(EMAIL)
    })

    it("treats an address whose verification is unknown as unverified", async () => {
      setAccount({
        sats: 50_000,
        phone: PHONE,
        email: { address: EMAIL, verified: null },
      })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(false)
      expect(result.current.unverifiedEmail).toBe(EMAIL)
    })

    it("hands no address to the setup when the unverified email has none", async () => {
      setAccount({ sats: 50_000, email: { address: null, verified: false } })

      const { result } = await renderEnforcement()

      expect(result.current.missingMethod).toBe(TwoFactorMethod.Email)
      expect(result.current.unverifiedEmail).toBeNull()
    })

    it("offers a phone once the email is verified, with no address to re-verify", async () => {
      setAccount({ email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.missingMethod).toBe(TwoFactorMethod.Phone)
      expect(result.current.unverifiedEmail).toBeNull()
    })

    it("offers an email to an account with only a phone", async () => {
      setAccount({ phone: PHONE })

      const { result } = await renderEnforcement()

      expect(result.current.missingMethod).toBe(TwoFactorMethod.Email)
      expect(result.current.unverifiedEmail).toBeNull()
    })
  })

  describe("dismissal", () => {
    it("hides the card but not the banner once dismissed", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true })

      const { result } = await renderEnforcement()

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("persists the dismissal for the account", async () => {
      const { result } = await renderEnforcement()

      act(() => result.current.dismissNudgeCard())

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockSetItem).toHaveBeenCalledWith(
        storageKeyFor(ACCOUNT_ID),
        JSON.stringify({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true }),
      )
    })

    it("keeps a dismissal that lands in the same pass as a tier raise", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: false })
      const { result, rerender } = await renderEnforcement()

      setAccount({ sats: 500_000 })
      act(() => {
        rerender({})
        result.current.dismissNudgeCard()
      })

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(mockSetItem).toHaveBeenLastCalledWith(
        storageKeyFor(ACCOUNT_ID),
        JSON.stringify({ highestTier: TwoFactorTier.Required, nudgeCardDismissed: true }),
      )
    })

    it("ignores a dismissal without an account to store it for", async () => {
      mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
      const { result } = await renderEnforcement()

      act(() => result.current.dismissNudgeCard())

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("ignores a dismissal while the account's record is still loading", () => {
      mockGetItem.mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      act(() => result.current.dismissNudgeCard())

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("reports a dismissal the storage could not keep", async () => {
      const failure = new Error("disk full")
      mockSetItem.mockRejectedValue(failure)
      const { result } = await renderEnforcement()

      await act(async () => result.current.dismissNudgeCard())

      expect(mockReportError).toHaveBeenCalledWith(
        "Two-factor enforcement write",
        failure,
      )
    })
  })

  describe("account switch", () => {
    it("never applies the previous account's record to the next one", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.shouldShowNudgeCard).toBe(false)

      let resolveNextRead: (value: string | null) => void = () => {}
      mockGetItem.mockReturnValue(
        new Promise<string | null>((resolve) => {
          resolveNextRead = resolve
        }),
      )
      setAccount({ accountId: "custodial-account-2", sats: 50_000 })
      rerender({})

      expect(result.current.shouldShowNudgeCard).toBe(false)

      await act(async () => resolveNextRead(null))

      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(mockGetItem).toHaveBeenLastCalledWith(storageKeyFor("custodial-account-2"))
    })
  })
})
