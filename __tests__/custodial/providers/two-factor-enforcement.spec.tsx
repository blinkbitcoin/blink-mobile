import React from "react"
import { act, renderHook } from "@testing-library/react-native"

import {
  TwoFactorEnforcementProvider,
  useTwoFactorEnforcement,
} from "@app/custodial/providers/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
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

let mockIsAtLeastLevelOne = true
jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ isAtLeastLevelOne: mockIsAtLeastLevelOne }),
}))

const mockLogTwoFactorPromptShown = jest.fn()
const mockLogTwoFactorPromptDismissed = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
  logTwoFactorPromptDismissed: (...args: unknown[]) =>
    mockLogTwoFactorPromptDismissed(...args),
}))

/** The wind-down's push into the migration, which the full-screen prompt yields to. */
const mockMigrateNowRemedy = { isDue: false, isPending: false, windDown: null }
const mockUseMigrateNowRemedy = jest.fn(
  (_options?: { skip?: boolean }) => mockMigrateNowRemedy,
)
jest.mock("@app/screens/account-migration/hooks/use-migrate-now-prompt", () => ({
  useMigrateNowRemedy: (options?: { skip?: boolean }) => mockUseMigrateNowRemedy(options),
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
  loading?: boolean
  error?: Error
}

const setAccount = ({
  accountId = ACCOUNT_ID,
  phone = null,
  email = null,
  totpEnabled = false,
  sats = 0,
  usdCents = 0,
  loading = false,
  error,
}: MeOverrides = {}) => {
  mockUseSettingsScreenQuery.mockReturnValue({
    loading,
    error,
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

const setNoAccount = () =>
  mockUseSettingsScreenQuery.mockReturnValue({ loading: false, data: undefined })

const DEFAULT_RECORD: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  highBalanceCurrency: WalletCurrency.Btc,
  nudgeCardDismissed: false,
  requiredDismissals: 0,
  authenticatorDismissals: 0,
}

const storeRecord = (record: Partial<TwoFactorEnforcementRecord>) =>
  mockGetItem.mockResolvedValue(JSON.stringify({ ...DEFAULT_RECORD, ...record }))

const lastWrittenRecord = (): TwoFactorEnforcementRecord =>
  JSON.parse(mockSetItem.mock.calls.at(-1)?.[1])

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <TwoFactorEnforcementProvider>{children}</TwoFactorEnforcementProvider>
)

const renderEnforcement = async () => {
  const rendered = renderHook(() => useTwoFactorEnforcement(), { wrapper })
  await act(async () => {})
  return rendered
}

const resetProviderMocks = () => {
  jest.clearAllMocks()
  mockEnforcementEnabled = true
  mockIsAuthed = true
  mockIsAtLeastLevelOne = true
  mockAccountType = AccountType.Custodial
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
  mockMigrateNowRemedy.isDue = false
  mockMigrateNowRemedy.isPending = false
  setAccount({ sats: 50_000 })
}

describe("TwoFactorEnforcementProvider", () => {
  beforeEach(resetProviderMocks)

  describe("gating", () => {
    it("is inert without a provider", () => {
      const { result } = renderHook(() => useTwoFactorEnforcement())

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(result.current.isSessionStartPending).toBe(false)
      act(() => {
        result.current.dismissNudgeCard()
        result.current.registerDismissal(TwoFactorTier.Required)
        result.current.consumeSessionStart()
        result.current.markPromptShown("home_card")
      })
      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptShown).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    it("reads the account fresh from the network each session, then from the cache", async () => {
      await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
          fetchPolicy: "cache-and-network",
          nextFetchPolicy: "cache-first",
        }),
      )
    })

    it("shows nothing while the flag is off", async () => {
      mockEnforcementEnabled = false

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    /** A trial account adds no factor: the settings offer it no login methods, and it
     *  upgrades through the phone login instead. */
    it("shows nothing for a trial account, and does not read it", async () => {
      mockIsAtLeastLevelOne = false

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(mockGetItem).not.toHaveBeenCalled()
      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("shows nothing until the account's record has loaded, and holds the home meanwhile", () => {
      mockGetItem.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
      expect(result.current.isPreparingSessionStart).toBe(true)
    })

    it("holds the home only while the record is being read, not once it is in", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.isPreparingSessionStart).toBe(false)
    })

    it("keeps the account unloaded and writes nothing when its record cannot be read", async () => {
      mockGetItem.mockRejectedValue(new Error("storage unavailable"))
      setAccount({ sats: 50_000 })

      const { result } = await renderEnforcement()

      expect(mockReportError).toHaveBeenCalledWith(
        "Two-factor enforcement read",
        expect.any(Error),
      )
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()

      act(() => result.current.dismissNudgeCard())

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("treats content it cannot parse as a failed read, not as a missing record", async () => {
      mockGetItem.mockResolvedValue("{not json")
      setAccount({ sats: 50_000 })

      const { result } = await renderEnforcement()

      expect(mockReportError).toHaveBeenCalledWith(
        "Two-factor enforcement read",
        expect.any(Error),
      )
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("marks the session as the account's, with nothing to start, when the record cannot be read", async () => {
      mockGetItem.mockRejectedValue(new Error("storage unavailable"))
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("ignores a self-custodial account even when the query still answers", async () => {
      mockAccountType = AccountType.SelfCustodial

      const { result } = await renderEnforcement()

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
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

    it("shows nothing without an account, and does not hold the home for one", async () => {
      setNoAccount()

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(mockGetItem).not.toHaveBeenCalled()
    })
  })

  describe("tiers", () => {
    it("stays quiet below the nudge threshold", async () => {
      setAccount({ sats: 49_999, usdCents: 4_999 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("shows the card and the banner at the nudge tier without two factors", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Nudge)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Nudge)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("reaches the tier from the dollar wallet alone", async () => {
      setAccount({ usdCents: 5_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Nudge)
    })

    it("hands the required tier to the session prompt and keeps the banner", async () => {
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Required)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
      expect(result.current.remainingDismissals).toBe(3)
    })

    /** The banner stays until the account holds two factors, whatever the tier: the
     *  setup it opens leads with the authenticator, which the highest tier asks for. */
    it("owes the protection screen at the authenticator tier, with the banner but no card", async () => {
      setAccount({ sats: 5_000_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Authenticator)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Authenticator)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
    })

    /** The ticket's one exception: an account that already holds two factors is asked
     *  for its authenticator by the session prompt alone. */
    it("drops the banner at the authenticator tier once the account holds two factors", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.unmetTier).toBe(TwoFactorTier.Authenticator)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("keeps the highest tier the account ever reached", async () => {
      setAccount({ sats: 0 })
      storeRecord({ highestTier: TwoFactorTier.Required })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Required)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("stores the tier the moment the balance crosses a higher threshold", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Required,
        nudgeCardDismissed: true,
      })
    })

    it("does not rewrite a tier the record already holds", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge })

      await renderEnforcement()

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("remembers the wallet that crossed into the authenticator tier", async () => {
      setAccount({ usdCents: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.highBalanceCurrency).toBe(WalletCurrency.Usd)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Authenticator,
        highBalanceCurrency: WalletCurrency.Usd,
      })
    })

    it("keeps naming the wallet that crossed after the balance moved on", async () => {
      setAccount({ sats: 0, usdCents: 0 })
      storeRecord({
        highestTier: TwoFactorTier.Authenticator,
        highBalanceCurrency: WalletCurrency.Usd,
      })

      const { result } = await renderEnforcement()

      expect(result.current.highBalanceCurrency).toBe(WalletCurrency.Usd)
    })
  })

  describe("factors", () => {
    it("never prompts an account with a phone and a verified email below the authenticator tier", async () => {
      setAccount({ sats: 500_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(true)
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("still asks for an authenticator at the authenticator tier with two factors", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasTwoFactor).toBe(true)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Authenticator)
      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
    })

    it("asks for nothing at the authenticator tier once an authenticator is set", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, totpEnabled: true })

      const { result } = await renderEnforcement()

      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.None)
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

  describe("nudge card dismissal", () => {
    it("hides the card but not the banner once dismissed", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge, nudgeCardDismissed: true })

      const { result } = await renderEnforcement()

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("persists the dismissal for the account, and logs it for the tier", async () => {
      const { result } = await renderEnforcement()

      act(() => result.current.dismissNudgeCard())

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockSetItem).toHaveBeenCalledWith(
        storageKeyFor(ACCOUNT_ID),
        JSON.stringify({
          ...DEFAULT_RECORD,
          highestTier: TwoFactorTier.Nudge,
          nudgeCardDismissed: true,
        }),
      )
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledTimes(1)
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
        tier: TwoFactorTier.Nudge,
        prompt: "home_card",
      })
    })

    it("keeps a dismissal that lands in the same pass as a tier raise", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge })
      const { result, rerender } = await renderEnforcement()

      setAccount({ sats: 500_000 })
      act(() => {
        rerender({})
        result.current.dismissNudgeCard()
      })

      expect(result.current.tier).toBe(TwoFactorTier.Required)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Required,
        nudgeCardDismissed: true,
      })
    })

    it("ignores a dismissal without an account to store it for, and logs none", async () => {
      setNoAccount()
      const { result } = await renderEnforcement()

      act(() => result.current.dismissNudgeCard())

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    it("ignores a dismissal while the account's record is still loading, and logs none", () => {
      mockGetItem.mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      act(() => result.current.dismissNudgeCard())

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    it("reports a dismissal the storage could not keep, and still honours it for the session", async () => {
      const failure = new Error("disk full")
      mockSetItem.mockRejectedValue(failure)
      const { result } = await renderEnforcement()
      expect(result.current.shouldShowNudgeCard).toBe(true)

      await act(async () => result.current.dismissNudgeCard())

      expect(mockReportError).toHaveBeenCalledWith(
        "Two-factor enforcement write",
        failure,
      )
      expect(result.current.shouldShowNudgeCard).toBe(false)
    })
  })

  describe("session start", () => {
    it("is pending once the record and a fresh read of the account are in", async () => {
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("is pending from the local read alone when it already owes a prompt, before the fresh read lands", async () => {
      setAccount({ sats: 500_000, loading: true })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("waits for the fresh read while the local read owes nothing, since that read can still raise the tier", async () => {
      setAccount({ sats: 0, loading: true })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(false)

      setAccount({ sats: 500_000, loading: false })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("stands the protection screen in for the home while the start that owes it is pending", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required, requiredDismissals: 3 })

      const { result } = await renderEnforcement()
      expect(result.current.isProtectionGateActive).toBe(true)

      act(() => result.current.consumeSessionStart())

      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("keeps the protection screen down for a prompt that is only the modal", async () => {
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("lets the home in once the gate's dismissal takes the start, with the dismissal charged", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })
      const { result } = await renderEnforcement()
      expect(result.current.isProtectionGateActive).toBe(true)

      act(() => result.current.registerDismissal(TwoFactorTier.Authenticator))

      expect(result.current.isProtectionGateActive).toBe(false)
      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.remainingDismissals).toBe(2)
    })

    it("keeps the protection screen down for a tier crossed after the start was taken", async () => {
      setAccount({ sats: 500_000, phone: PHONE, email: verifiedEmail })
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.consumeSessionStart())

      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })
      await act(async () => rerender({}))

      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("decides from the account as last read when the fresh read fails, rather than skip the session", async () => {
      setAccount({ sats: 500_000, error: new Error("network down") })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("stays inert when the fresh read fails with nothing cached, without holding the home", async () => {
      mockUseSettingsScreenQuery.mockReturnValue({
        loading: false,
        error: new Error("network down"),
        data: undefined,
      })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("stands the protection screen in when a fresher read raises the tier while the start is still pending", async () => {
      setAccount({ sats: 500_000 })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
      expect(result.current.isProtectionGateActive).toBe(false)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))

      expect(result.current.isProtectionGateActive).toBe(true)
    })

    it("is pending even when nothing is owed, so the session can be taken", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("stops being pending once taken, whatever the balance does next", async () => {
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.consumeSessionStart())

      setAccount({ sats: 500_000 })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("owes the protection screen once the required tier has no dismissals left", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required, requiredDismissals: 3 })

      const { result } = await renderEnforcement()

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
    })

    it("is pending again on a fresh login of the same account", async () => {
      setAccount({ sats: 500_000 })
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.consumeSessionStart())
      expect(result.current.isSessionStartPending).toBe(false)

      setNoAccount()
      rerender({})
      setAccount({ sats: 500_000 })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(true)
    })
  })
})

/** Split from the block above only to keep each one under the file's line budget. */
describe("TwoFactorEnforcementProvider dismissals and account switches", () => {
  beforeEach(resetProviderMocks)

  describe("wind-down precedence", () => {
    const atBlockingTier = () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required, requiredDismissals: 3 })
    }

    it("yields the protection screen to the wind-down's push into the migration, leaving the start to the home", async () => {
      atBlockingTier()
      mockMigrateNowRemedy.isDue = true

      const { result } = await renderEnforcement()

      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
      expect(result.current.isProtectionGateActive).toBe(false)
      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(result.current.isSessionStartPending).toBe(true)
    })

    /** A network that never answers must not hold the home blank, so the prompt does
     *  not wait for the wind-down; it yields once the answer is in. */
    it("stands the protection screen in before the wind-down answers, and yields once it says the push applies", async () => {
      atBlockingTier()
      mockMigrateNowRemedy.isPending = true
      const { result, rerender } = await renderEnforcement()

      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(true)

      mockMigrateNowRemedy.isPending = false
      mockMigrateNowRemedy.isDue = true
      rerender({})

      expect(result.current.isProtectionGateActive).toBe(false)
      expect(result.current.isSessionStartPending).toBe(true)
    })

    it("asks the wind-down only while enforcement applies", async () => {
      mockEnforcementEnabled = false
      await renderEnforcement()
      expect(mockUseMigrateNowRemedy).toHaveBeenLastCalledWith({ skip: true })

      mockEnforcementEnabled = true
      await renderEnforcement()
      expect(mockUseMigrateNowRemedy).toHaveBeenLastCalledWith({ skip: false })
    })
  })

  describe("session dismissals", () => {
    it("takes the session start with a dismissal, whether or not the tier counts it", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge })
      const { result } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(true)

      act(() => result.current.registerDismissal(TwoFactorTier.Nudge))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("takes the start with a dismissal reported from a flow the modal opened, so the home does not ask again", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required })
      const { result } = await renderEnforcement()
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)

      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.remainingDismissals).toBe(2)
    })

    it("keeps the start for a prompt a fresher read raised past the one dismissed, while counting the dismissal", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))
      expect(result.current.isProtectionGateActive).toBe(true)

      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.isProtectionGateActive).toBe(true)
      expect(lastWrittenRecord().requiredDismissals).toBe(1)

      /** The higher tier's prompt, raised in the same session, counts its own dismissal. */
      act(() => result.current.registerDismissal(TwoFactorTier.Authenticator))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(lastWrittenRecord().authenticatorDismissals).toBe(1)
    })

    it("keeps a start the fresh read has not decided yet, which may still come to owe a prompt", async () => {
      setAccount({ sats: 50_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Nudge })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(false)

      act(() => result.current.registerDismissal(TwoFactorTier.Nudge))

      setAccount({ sats: 500_000 })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)
    })

    it("leaves the session untouched by a dismissal that neither counts nor takes a start", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required })
      const { result } = await renderEnforcement()
      act(() => result.current.registerDismissal(TwoFactorTier.Required))
      const settled = result.current

      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(result.current).toBe(settled)
      expect(mockSetItem).toHaveBeenCalledTimes(1)
    })

    it("counts a dismissal against the required tier at most once per session", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required })
      const { result } = await renderEnforcement()

      act(() => {
        result.current.registerDismissal(TwoFactorTier.Required)
        result.current.registerDismissal(TwoFactorTier.Required)
      })

      expect(result.current.remainingDismissals).toBe(2)
      expect(mockSetItem).toHaveBeenCalledTimes(1)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Required,
        requiredDismissals: 1,
      })
    })

    it("charges the dismissal to the tier of the prompt that was waved away", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })
      storeRecord({ highestTier: TwoFactorTier.Authenticator, requiredDismissals: 3 })
      const { result } = await renderEnforcement()
      expect(result.current.remainingDismissals).toBe(3)

      act(() => result.current.registerDismissal(TwoFactorTier.Authenticator))

      expect(result.current.remainingDismissals).toBe(2)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Authenticator,
        requiredDismissals: 3,
        authenticatorDismissals: 1,
      })
    })

    it("turns the required prompt into the protection screen on the third dismissal", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Required, requiredDismissals: 2 })
      const { result } = await renderEnforcement()
      expect(result.current.requiredPrompt).toBe(TwoFactorSessionPrompt.RequiredModal)

      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.requiredPrompt).toBe(
        TwoFactorSessionPrompt.ProtectionRequired,
      )
    })

    it("ignores a dismissal charged to the nudge tier", async () => {
      storeRecord({ highestTier: TwoFactorTier.Nudge })
      const { result } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Nudge))

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("ignores a dismissal while the account's record is still loading", () => {
      setAccount({ sats: 500_000 })
      mockGetItem.mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("counts again in the next session", async () => {
      setAccount({ sats: 500_000 })
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.registerDismissal(TwoFactorTier.Required))
      mockGetItem.mockResolvedValue(mockSetItem.mock.calls.at(-1)?.[1])

      setNoAccount()
      rerender({})
      setAccount({ sats: 500_000 })
      await act(async () => rerender({}))
      act(() => result.current.registerDismissal(TwoFactorTier.Required))

      expect(result.current.remainingDismissals).toBe(1)
      expect(lastWrittenRecord().requiredDismissals).toBe(2)
    })
  })

  describe("account switch", () => {
    it("drops a record that lands after the provider is gone", async () => {
      let resolveRead: (value: string | null) => void = () => {}
      mockGetItem.mockReturnValue(
        new Promise<string | null>((resolve) => {
          resolveRead = resolve
        }),
      )
      const { result, unmount } = renderHook(() => useTwoFactorEnforcement(), {
        wrapper,
      })
      unmount()

      await act(async () => resolveRead(JSON.stringify(DEFAULT_RECORD)))

      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("drops a failed read that lands after the provider is gone, without reporting it", async () => {
      let rejectRead: (reason: Error) => void = () => {}
      mockGetItem.mockReturnValue(
        new Promise<string | null>((_, reject) => {
          rejectRead = reject
        }),
      )
      const { unmount } = renderHook(() => useTwoFactorEnforcement(), { wrapper })
      unmount()

      await act(async () => rejectRead(new Error("storage unavailable")))

      expect(mockReportError).not.toHaveBeenCalled()
    })

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

    /** The tier reaches the context and the events, not only the prompts. */
    it("reports no tier from the previous account's record while the next one loads", async () => {
      setAccount({ sats: 0 })
      storeRecord({ highestTier: TwoFactorTier.Required, nudgeCardDismissed: false })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.tier).toBe(TwoFactorTier.Required)

      mockGetItem.mockReturnValue(new Promise(() => {}))
      setAccount({ accountId: "custodial-account-2", sats: 0 })
      rerender({})

      expect(result.current.tier).toBe(TwoFactorTier.None)
    })
  })

  describe("impressions", () => {
    it("logs a prompt as shown once per session, however often its surface mounts", async () => {
      const { result } = await renderEnforcement()

      act(() => result.current.markPromptShown("home_card"))
      act(() => result.current.markPromptShown("home_card"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
        tier: TwoFactorTier.Nudge,
        prompt: "home_card",
      })
    })

    it("logs each surface on its own", async () => {
      const { result } = await renderEnforcement()

      act(() => result.current.markPromptShown("home_card"))
      act(() => result.current.markPromptShown("settings_banner"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(2)
      expect(mockLogTwoFactorPromptShown).toHaveBeenLastCalledWith({
        tier: TwoFactorTier.Nudge,
        prompt: "settings_banner",
      })
    })

    it("logs a prompt again once it is shown at a higher tier", async () => {
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.markPromptShown("settings_banner"))

      setAccount({ sats: 500_000 })
      rerender({})
      act(() => result.current.markPromptShown("settings_banner"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(2)
      expect(mockLogTwoFactorPromptShown).toHaveBeenLastCalledWith({
        tier: TwoFactorTier.Required,
        prompt: "settings_banner",
      })
    })

    it("logs a prompt again for the next account", async () => {
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.markPromptShown("home_card"))

      setAccount({ accountId: "custodial-account-2", sats: 50_000 })
      await act(async () => rerender({}))
      act(() => result.current.markPromptShown("home_card"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(2)
    })

    /** A gate that closes and opens again within the session, as the flag can, is not
     *  a new session for the same account. */
    it("does not log a prompt again when the same account merely comes back", async () => {
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.markPromptShown("home_card"))

      mockEnforcementEnabled = false
      await act(async () => rerender({}))
      mockEnforcementEnabled = true
      await act(async () => rerender({}))
      act(() => result.current.markPromptShown("home_card"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    })

    it("logs nothing without an account to show a prompt to", async () => {
      setNoAccount()
      const { result } = await renderEnforcement()

      act(() => result.current.markPromptShown("home_card"))

      expect(mockLogTwoFactorPromptShown).not.toHaveBeenCalled()
    })
  })
})
