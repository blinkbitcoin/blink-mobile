import React from "react"
import { act, renderHook } from "@testing-library/react-native"

import {
  TwoFactorEnforcementProvider,
  useTwoFactorEnforcement,
} from "@app/custodial/providers/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorPrompt,
  TwoFactorReminderReason,
  TwoFactorSessionPrompt,
  TwoFactorThresholds,
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
/** Whether this launch's console fetch has settled. */
let mockIsConfigFresh = true
/** The tier thresholds as the console sets them; the shipped ones unless a test moves
 *  one. */
let mockThresholds: TwoFactorThresholds | undefined
jest.mock("@app/config/feature-flags-context", () => {
  const { defaultTwoFactorThresholds } = jest.requireActual(
    "@app/config/feature-flags-context",
  )
  return {
    useRemoteConfig: () => ({
      custodialTwoFactorEnforcementEnabled: mockEnforcementEnabled,
      custodialTwoFactorThresholds: mockThresholds ?? defaultTwoFactorThresholds,
    }),
    useFeatureFlags: () => ({ remoteConfigReady: mockIsConfigFresh }),
  }
})

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

/** The wind-down's push into the migration, which the blocking screen yields to. */
const mockMigrateNowRemedy = { isDue: false, isPending: false, windDown: null }
const mockUseMigrateNowRemedy = jest.fn(() => mockMigrateNowRemedy)
jest.mock("@app/screens/account-migration/hooks/use-migrate-now-prompt", () => ({
  useMigrateNowRemedy: () => mockUseMigrateNowRemedy(),
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

const SHIPPED_THRESHOLDS: TwoFactorThresholds = jest.requireActual(
  "@app/config/feature-flags-context",
).defaultTwoFactorThresholds

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
  enforcedCurrency: WalletCurrency.Btc,
  enforcedThreshold: 0,
  nudgeCardDismissed: false,
  recommendedDismissals: 0,
  enforcedDismissals: 0,
  highestSats: 0,
  highestUsdCents: 0,
  isNewHighPending: false,
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
  mockIsConfigFresh = true
  mockThresholds = undefined
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
      expect(result.current.shouldShowReminderBulletin).toBe(false)
      expect(result.current.reminderReason).toBeNull()
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(result.current.isSessionStartPending).toBe(false)
      act(() => {
        result.current.dismissNudgeCard()
        result.current.dismissReminderBulletin()
        result.current.registerDismissal(TwoFactorTier.Recommended)
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

    /** Content the store hands over but that no longer parses is unusable: storage reads
     *  it as absent, so the account starts afresh and the record written then replaces
     *  it, instead of the key staying unreadable for good. */
    it("reads content it cannot parse as no record, which the next write replaces", async () => {
      mockGetItem.mockResolvedValue("{not json")
      setAccount({ sats: 50_000 })

      const { result } = await renderEnforcement()

      expect(mockReportError).not.toHaveBeenCalled()
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(mockSetItem).toHaveBeenCalled()
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
    it("stays quiet below the suggested threshold", async () => {
      setAccount({ sats: 49_999, usdCents: 4_999 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
    })

    it("shows the card and the banner at the suggested tier without an authenticator", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Suggested)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Suggested)
      expect(result.current.shouldShowNudgeCard).toBe(true)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("reaches the tier from the dollar wallet alone", async () => {
      setAccount({ usdCents: 5_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Suggested)
    })

    /** The recommended tier reminds on the home and never interrupts the session start.
     *  */
    it("owes no session prompt at the recommended tier, and keeps the banner", async () => {
      setAccount({ sats: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Recommended)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
      expect(result.current.remainingDismissals).toBe(3)
    })

    /** The banner stays until the account holds an authenticator, whatever the tier. */
    it("owes the modal at the enforced tier, with the banner but no card", async () => {
      setAccount({ sats: 5_000_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Enforced)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Enforced)
      expect(result.current.shouldShowNudgeCard).toBe(false)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
      expect(result.current.remainingDismissals).toBe(3)
    })

    it("keeps the banner at the enforced tier for an account with a phone and a verified email", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.unmetTier).toBe(TwoFactorTier.Enforced)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("keeps the highest tier the account ever reached", async () => {
      setAccount({ sats: 0 })
      storeRecord({ highestTier: TwoFactorTier.Recommended })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Recommended)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("stores the tier the moment the balance crosses a higher threshold", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Suggested, nudgeCardDismissed: true })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Recommended,
        nudgeCardDismissed: true,
        highestSats: 500_000,
      })
    })

    it("does not rewrite a tier the record already holds", async () => {
      storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })

      await renderEnforcement()

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("remembers the wallet that crossed into the enforced tier", async () => {
      setAccount({ usdCents: 500_000 })

      const { result } = await renderEnforcement()

      expect(result.current.enforcedCurrency).toBe(WalletCurrency.Usd)
      expect(result.current.enforcedThreshold).toBe(500_000)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Enforced,
        enforcedCurrency: WalletCurrency.Usd,
        enforcedThreshold: 500_000,
        highestUsdCents: 500_000,
      })
    })

    /** A threshold lowered in the console raises the accounts it now covers. */
    it("starts a tier where the console moved its threshold", async () => {
      mockThresholds = { ...SHIPPED_THRESHOLDS, recommendedSats: 400_000 }
      setAccount({ sats: 450_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(lastWrittenRecord().highestTier).toBe(TwoFactorTier.Recommended)
    })

    /** Until this launch's console fetch settles, the thresholds are what an earlier
     *  launch activated: a tier raised from them would stay raised once a higher one
     *  lands, so none is read from the balance until then. */
    it("raises no tier from the balance until this launch's thresholds land", async () => {
      mockIsConfigFresh = false
      setAccount({ sats: 6_000_000 })
      const { result, rerender } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.None)
      expect(result.current.isSessionStartPending).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()

      mockThresholds = { ...SHIPPED_THRESHOLDS, enforcedSats: 10_000_000 }
      mockIsConfigFresh = true
      await act(async () => rerender({}))

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(result.current.isSessionStartPending).toBe(true)
      expect(lastWrittenRecord().highestTier).toBe(TwoFactorTier.Recommended)
    })

    /** The stored tier never lowers, so what it calls for need not wait. */
    it("puts up the prompt the stored tier calls for before the thresholds land", async () => {
      mockIsConfigFresh = false
      setAccount({ sats: 6_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced })

      const { result } = await renderEnforcement()

      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
      expect(result.current.isSessionStartPending).toBe(true)
    })

    /** Raising a threshold never lowers a tier an account already reached. */
    it("keeps a reached tier when the console raises its threshold above the balance", async () => {
      mockThresholds = { ...SHIPPED_THRESHOLDS, recommendedSats: 900_000 }
      setAccount({ sats: 600_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended, highestSats: 600_000 })

      const { result } = await renderEnforcement()

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("keeps naming the wallet that crossed after the balance moved on", async () => {
      setAccount({ sats: 0, usdCents: 0 })
      storeRecord({
        highestTier: TwoFactorTier.Enforced,
        enforcedCurrency: WalletCurrency.Usd,
      })

      const { result } = await renderEnforcement()

      expect(result.current.enforcedCurrency).toBe(WalletCurrency.Usd)
    })

    /** The tier stays once reached, so the copy keeps quoting what raised it. */
    it("keeps quoting the threshold crossed after the console raises it", async () => {
      mockThresholds = { ...SHIPPED_THRESHOLDS, enforcedSats: 8_000_000 }
      setAccount({ sats: 0 })
      storeRecord({
        highestTier: TwoFactorTier.Enforced,
        enforcedThreshold: 5_000_000,
      })

      const { result } = await renderEnforcement()

      expect(result.current.enforcedThreshold).toBe(5_000_000)
    })

    it("quotes the configured threshold for a record from before the crossing was kept", async () => {
      setAccount({ sats: 0 })
      storeRecord({ highestTier: TwoFactorTier.Enforced })

      const { result } = await renderEnforcement()

      expect(result.current.enforcedThreshold).toBe(SHIPPED_THRESHOLDS.enforcedSats)
    })
  })

  describe("the authenticator", () => {
    /** An attacker who takes an account over can change both its email and its phone,
     *  so those two together are no second factor: the account is prompted. */
    it("prompts an account with a phone and a verified email but no authenticator", async () => {
      setAccount({ sats: 500_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasAuthenticator).toBe(false)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Recommended)
      expect(result.current.shouldShowSettingsBanner).toBe(true)
    })

    it("asks for an authenticator at the enforced tier from an account with a phone and a verified email", async () => {
      setAccount({ sats: 5_000_000, phone: PHONE, email: verifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasAuthenticator).toBe(false)
      expect(result.current.unmetTier).toBe(TwoFactorTier.Enforced)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("asks for nothing at any tier once an authenticator is set, whatever else the account holds", async () => {
      setAccount({ sats: 5_000_000, totpEnabled: true })

      const { result } = await renderEnforcement()

      expect(result.current.hasAuthenticator).toBe(true)
      expect(result.current.unmetTier).toBe(TwoFactorTier.None)
      expect(result.current.shouldShowSettingsBanner).toBe(false)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("does not count an email, verified or not, toward the authenticator it asks for", async () => {
      setAccount({ sats: 50_000, phone: PHONE, email: unverifiedEmail })

      const { result } = await renderEnforcement()

      expect(result.current.hasAuthenticator).toBe(false)
      expect(result.current.shouldShowNudgeCard).toBe(true)
    })
  })

  describe("nudge card dismissal", () => {
    it("hides the card but not the banner once dismissed", async () => {
      storeRecord({ highestTier: TwoFactorTier.Suggested, nudgeCardDismissed: true })

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
          highestTier: TwoFactorTier.Suggested,
          nudgeCardDismissed: true,
          highestSats: 50_000,
        }),
      )
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledTimes(1)
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
        tier: TwoFactorTier.Suggested,
        prompt: "home_card",
      })
    })

    it("keeps a dismissal that lands in the same pass as a tier raise", async () => {
      storeRecord({ highestTier: TwoFactorTier.Suggested })
      const { result, rerender } = await renderEnforcement()

      setAccount({ sats: 500_000 })
      act(() => {
        rerender({})
        result.current.dismissNudgeCard()
      })

      expect(result.current.tier).toBe(TwoFactorTier.Recommended)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Recommended,
        nudgeCardDismissed: true,
        highestSats: 500_000,
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
      setAccount({ sats: 5_000_000 })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("is pending from the local read alone when it already owes a prompt, before the fresh read lands", async () => {
      setAccount({ sats: 5_000_000, loading: true })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("waits for the fresh read while the local read owes nothing, since that read can still raise the tier", async () => {
      setAccount({ sats: 0, loading: true })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(false)

      setAccount({ sats: 5_000_000, loading: false })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("stands the blocking screen in for the home while the start that owes it is pending", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 3 })

      const { result } = await renderEnforcement()
      expect(result.current.isProtectionGateActive).toBe(true)

      act(() => result.current.consumeSessionStart())

      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("keeps the blocking screen down for a prompt that is only the modal", async () => {
      setAccount({ sats: 5_000_000 })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("takes the start with the modal's dismissal, with the dismissal charged", async () => {
      setAccount({ sats: 5_000_000 })
      const { result } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(true)

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.remainingDismissals).toBe(2)
    })

    it("keeps the blocking screen down for a tier crossed after the start was taken", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ enforcedDismissals: 3 })
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.consumeSessionStart())

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))

      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.ProtectionRequired)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("decides from the account as last read when the fresh read fails, rather than skip the session", async () => {
      setAccount({ sats: 5_000_000, error: new Error("network down") })

      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
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

    it("stands the blocking screen in when a fresher read raises the tier while the start is still pending", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ enforcedDismissals: 3 })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
      expect(result.current.isProtectionGateActive).toBe(false)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))

      expect(result.current.isProtectionGateActive).toBe(true)
    })

    it("is pending even when nothing is owed, so the session can be taken", async () => {
      const { result } = await renderEnforcement()

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
    })

    it("stops being pending once taken, whatever the balance does next", async () => {
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.consumeSessionStart())

      setAccount({ sats: 5_000_000 })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("owes the blocking screen once the enforced tier has no dismissals left", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 3 })

      const { result } = await renderEnforcement()

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.ProtectionRequired)
    })

    /** Only the enforced tier blocks: the recommended tier never does, however many
     *  dismissals it has spent. */
    it("never blocks at the recommended tier, however many dismissals it spent", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended, recommendedDismissals: 10 })

      const { result } = await renderEnforcement()

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
      expect(result.current.isProtectionGateActive).toBe(false)
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
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 3 })
    }

    it("yields the blocking screen to the wind-down's push into the migration, leaving the start to the home", async () => {
      atBlockingTier()
      mockMigrateNowRemedy.isDue = true

      const { result } = await renderEnforcement()

      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.ProtectionRequired)
      expect(result.current.isProtectionGateActive).toBe(false)
      expect(result.current.isPreparingSessionStart).toBe(false)
      expect(result.current.isSessionStartPending).toBe(true)
    })

    /** A network that never answers must not hold the home blank, so the prompt does
     *  not wait for the wind-down; it yields once the answer is in. */
    it("stands the blocking screen in before the wind-down answers, and yields once it says the push applies", async () => {
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
  })

  describe("session dismissals", () => {
    it("takes the session start with a dismissal, whether or not the tier counts it", async () => {
      storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })
      const { result } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(true)

      act(() => result.current.registerDismissal(TwoFactorTier.Suggested))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    /** The last of the modal's dismissals is what makes the blocking screen due, and
     *  it is due at the next session start: one made before the fresh read landed must
     *  not raise it in this one. */
    it("leaves the blocking screen to the next session when the modal's last dismissal comes before the fresh read", async () => {
      setAccount({ sats: 5_000_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 2 })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)

      act(() =>
        result.current.registerDismissal(TwoFactorTier.Enforced, {
          prompt: TwoFactorPrompt.SessionModal,
        }),
      )
      expect(lastWrittenRecord().enforcedDismissals).toBe(3)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))

      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.ProtectionRequired)
      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("takes the start with a dismissal reported from a flow the modal opened, so the home does not ask again", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result } = await renderEnforcement()
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.remainingDismissals).toBe(2)
    })

    /** A setup left unfinished at the recommended tier, after a fresher read raised the
     *  account to the enforced tier, does not answer the modal that tier owes. */
    it("keeps the start for a prompt a fresher read raised past the one dismissed, while counting the dismissal", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current.isSessionStartPending).toBe(true)
      expect(lastWrittenRecord().recommendedDismissals).toBe(1)

      /** The higher tier's prompt, raised in the same session, counts its own dismissal. */
      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(lastWrittenRecord().enforcedDismissals).toBe(1)
    })

    it("keeps a start the fresh read has not decided yet, which may still come to owe a prompt", async () => {
      setAccount({ sats: 50_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Suggested })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.isSessionStartPending).toBe(false)

      act(() => result.current.registerDismissal(TwoFactorTier.Suggested))

      setAccount({ sats: 5_000_000 })
      rerender({})

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    /** A setup left unfinished at the recommended tier while the fresh read is still out
     *  must not spend the start on the high-balance modal that read is about to raise. */
    it("keeps the start for a prompt the fresh read raises after the dismissal, with nothing shown meanwhile", async () => {
      setAccount({ sats: 500_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Recommended })
      const { result, rerender } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(lastWrittenRecord().recommendedDismissals).toBe(1)

      setAccount({ sats: 5_000_000, loading: false })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)
    })

    it("takes the start once the fresh read confirms the prompt waved away still covers the account", async () => {
      setAccount({ sats: 5_000_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result, rerender } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))
      setAccount({ sats: 5_000_000, loading: false })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    /** A read that fails lands as what the account last read as, which the dismissal
     *  already covered: the start is spent, not parked, so a balance that crosses
     *  later in the session waits for the next one. */
    it("takes the start when the fresh read fails after the dismissal", async () => {
      setAccount({ sats: 5_000_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result, rerender } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))
      setAccount({ sats: 5_000_000, loading: false, error: new Error("network down") })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)

      setAccount({ sats: 5_000_000 })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    /** The modal keeps its X and the back wired through its closing frames, when the
     *  home already reports no prompt: that second tap waves nothing away, and must
     *  not undo the dismissal kept for the read. */
    it("keeps a dismissal waiting for the read through a dismissal of no prompt", async () => {
      setAccount({ sats: 5_000_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result, rerender } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))
      act(() => result.current.registerDismissal(TwoFactorTier.None))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(mockSetItem).toHaveBeenCalledTimes(1)

      setAccount({ sats: 5_000_000, loading: false })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(false)
    })

    it("keeps the highest tier waved away while the read is out, through a lower one reported after it", async () => {
      setAccount({ sats: 5_000_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result, rerender } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))
      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current.isSessionStartPending).toBe(false)

      setAccount({ sats: 5_000_000, loading: false })
      await act(async () => rerender({}))

      expect(result.current.isSessionStartPending).toBe(false)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    /** A handler bound while the read was out can still fire after it landed, as the
     *  hardware back's can; the dismissal it reports is judged by what the account
     *  owes now, with no commit showing the home in between. */
    it("judges a dismissal bound while the read was out by what the account owes now, with no frame of the home between", async () => {
      setAccount({ sats: 500_000, loading: true })
      storeRecord({ highestTier: TwoFactorTier.Recommended, enforcedDismissals: 3 })
      const gateLog: boolean[] = []
      const { result, rerender } = renderHook(
        () => {
          const enforcement = useTwoFactorEnforcement()
          gateLog.push(enforcement.isProtectionGateActive)
          return enforcement
        },
        { wrapper },
      )
      await act(async () => {})
      const dismissBoundWhileReading = result.current.registerDismissal

      setAccount({ sats: 5_000_000, loading: false })
      await act(async () => rerender({}))
      expect(result.current.isProtectionGateActive).toBe(true)
      gateLog.length = 0

      mockSetItem.mockClear()
      act(() => dismissBoundWhileReading(TwoFactorTier.Recommended))

      expect(gateLog).not.toContain(false)
      expect(result.current.isProtectionGateActive).toBe(true)
      expect(result.current.isSessionStartPending).toBe(true)
      /** The start owes the blocking screen, which no dismissal answers. */
      expect(mockSetItem).not.toHaveBeenCalled()
    })

    /** The blocking screen has no X. From a working screen the user can still reach the
     *  setup through the Settings banner; leaving it must not take the start the screen
     *  is owed, nor count or report a dismissal of a tier whose dismissals are spent. */
    it("leaves a start owed to the blocking screen to it when a flow over it is left", async () => {
      setAccount({ sats: 6_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 3 })
      const { result } = await renderEnforcement()
      expect(result.current.isProtectionGateActive).toBe(true)

      act(() =>
        result.current.registerDismissal(TwoFactorTier.Enforced, {
          prompt: TwoFactorPrompt.SettingsBanner,
        }),
      )

      expect(result.current.isSessionStartPending).toBe(true)
      expect(result.current.isProtectionGateActive).toBe(true)
      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    it("leaves the session untouched by a dismissal that neither counts nor takes a start", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended, highestSats: 500_000 })
      const { result } = await renderEnforcement()
      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))
      const settled = result.current

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current).toBe(settled)
      expect(mockSetItem).toHaveBeenCalledTimes(1)
    })

    it("counts a dismissal against the recommended tier at most once per session", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended, highestSats: 500_000 })
      const { result } = await renderEnforcement()

      act(() => {
        result.current.registerDismissal(TwoFactorTier.Recommended)
        result.current.registerDismissal(TwoFactorTier.Recommended)
      })

      expect(result.current.remainingDismissals).toBe(2)
      expect(mockSetItem).toHaveBeenCalledTimes(1)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Recommended,
        recommendedDismissals: 1,
        highestSats: 500_000,
      })
    })

    it("charges the dismissal to the tier of the prompt that was waved away", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, recommendedDismissals: 3 })
      const { result } = await renderEnforcement()
      expect(result.current.remainingDismissals).toBe(3)

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))

      expect(result.current.remainingDismissals).toBe(2)
      expect(lastWrittenRecord()).toEqual({
        ...DEFAULT_RECORD,
        highestTier: TwoFactorTier.Enforced,
        recommendedDismissals: 3,
        enforcedDismissals: 1,
      })
    })

    it("turns the high-balance modal into the blocking screen on the third dismissal", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced, enforcedDismissals: 2 })
      const { result } = await renderEnforcement()
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.SessionModal)

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced))

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.ProtectionRequired)
    })

    it("never blocks the recommended tier on its third dismissal", async () => {
      setAccount({ sats: 500_000 })
      storeRecord({ highestTier: TwoFactorTier.Recommended, recommendedDismissals: 2 })
      const { result } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current.remainingDismissals).toBe(0)
      expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
      expect(result.current.isProtectionGateActive).toBe(false)
    })

    it("ignores a dismissal charged to the suggested tier, and reports none", async () => {
      storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })
      const { result } = await renderEnforcement()

      act(() =>
        result.current.registerDismissal(TwoFactorTier.Suggested, {
          prompt: TwoFactorPrompt.HomeCard,
        }),
      )

      expect(mockSetItem).not.toHaveBeenCalled()
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    /** A second press that lands before the prompt goes, as the modal's X can during
     *  its exit animation, counts nothing and reports nothing. */
    it("reports a counted dismissal once, as the dismissal of the prompt it answers", async () => {
      setAccount({ sats: 5_000_000 })
      storeRecord({ highestTier: TwoFactorTier.Enforced })
      const { result } = await renderEnforcement()
      const modal = { prompt: TwoFactorPrompt.SessionModal }

      act(() => result.current.registerDismissal(TwoFactorTier.Enforced, modal))
      act(() => result.current.registerDismissal(TwoFactorTier.Enforced, modal))

      expect(lastWrittenRecord().enforcedDismissals).toBe(1)
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledTimes(1)
      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
        tier: TwoFactorTier.Enforced,
        prompt: TwoFactorPrompt.SessionModal,
        reason: undefined,
      })
    })

    it("counts a dismissal that names no prompt without reporting one", async () => {
      setAccount({ sats: 500_000 })
      const { result } = await renderEnforcement()

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(lastWrittenRecord().recommendedDismissals).toBe(1)
      expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    })

    it("ignores a dismissal while the account's record is still loading", () => {
      setAccount({ sats: 500_000 })
      mockGetItem.mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useTwoFactorEnforcement(), { wrapper })

      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it("counts again in the next session", async () => {
      setAccount({ sats: 500_000 })
      const { result, rerender } = await renderEnforcement()
      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))
      mockGetItem.mockResolvedValue(mockSetItem.mock.calls.at(-1)?.[1])

      setNoAccount()
      rerender({})
      setAccount({ sats: 500_000 })
      await act(async () => rerender({}))
      act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

      expect(result.current.remainingDismissals).toBe(1)
      expect(lastWrittenRecord().recommendedDismissals).toBe(2)
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
      storeRecord({ highestTier: TwoFactorTier.Suggested, nudgeCardDismissed: true })
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
      storeRecord({ highestTier: TwoFactorTier.Recommended, nudgeCardDismissed: false })
      const { result, rerender } = await renderEnforcement()
      expect(result.current.tier).toBe(TwoFactorTier.Recommended)

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
        tier: TwoFactorTier.Suggested,
        prompt: "home_card",
      })
    })

    it("logs each surface on its own", async () => {
      const { result } = await renderEnforcement()

      act(() => result.current.markPromptShown("home_card"))
      act(() => result.current.markPromptShown("settings_banner"))

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(2)
      expect(mockLogTwoFactorPromptShown).toHaveBeenLastCalledWith({
        tier: TwoFactorTier.Suggested,
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
        tier: TwoFactorTier.Recommended,
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

/** The recommended tier reminds on the home, never at the session start and never by
 *  blocking: three sessions, then only when a wallet rises above its all-time high. */
describe("TwoFactorEnforcementProvider reminder bulletin", () => {
  beforeEach(resetProviderMocks)

  /** Three dismissals spent at the recommended tier, with the highs each wallet reached.
   *  */
  const pastFirstSessions = (
    highs: Pick<
      Partial<TwoFactorEnforcementRecord>,
      "highestSats" | "highestUsdCents" | "isNewHighPending"
    >,
  ) =>
    storeRecord({
      highestTier: TwoFactorTier.Recommended,
      recommendedDismissals: 3,
      ...highs,
    })

  const loginAgain = async (
    rerender: (props: object) => void,
    account: { sats?: number; usdCents?: number },
  ) => {
    mockGetItem.mockResolvedValue(mockSetItem.mock.calls.at(-1)?.[1])
    setNoAccount()
    rerender({})
    setAccount(account)
    await act(async () => rerender({}))
  }

  it("shows the bulletin in the card's place at the recommended tier, for the first sessions", async () => {
    setAccount({ sats: 500_000 })

    const { result } = await renderEnforcement()

    expect(result.current.shouldShowReminderBulletin).toBe(true)
    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.FirstSessions)
    expect(result.current.shouldShowNudgeCard).toBe(false)
    expect(result.current.sessionPrompt).toBe(TwoFactorSessionPrompt.None)
  })

  it("shows the bulletin even when the nudge card was closed", async () => {
    setAccount({ sats: 500_000 })
    storeRecord({ highestTier: TwoFactorTier.Suggested, nudgeCardDismissed: true })

    const { result } = await renderEnforcement()

    expect(result.current.shouldShowReminderBulletin).toBe(true)
  })

  it("shows no bulletin below or above the recommended tier", async () => {
    setAccount({ sats: 50_000 })
    const nudge = await renderEnforcement()
    expect(nudge.result.current.shouldShowReminderBulletin).toBe(false)
    expect(nudge.result.current.reminderReason).toBeNull()

    setAccount({ sats: 5_000_000 })
    const highBalance = await renderEnforcement()
    expect(highBalance.result.current.shouldShowReminderBulletin).toBe(false)
    expect(highBalance.result.current.reminderReason).toBeNull()
  })

  it("puts the bulletin away for the session when waved away, counting one dismissal and reporting its reason", async () => {
    setAccount({ sats: 500_000 })
    const { result } = await renderEnforcement()

    act(() => result.current.dismissReminderBulletin())

    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(lastWrittenRecord().recommendedDismissals).toBe(1)
    expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      prompt: TwoFactorPrompt.ReminderBulletin,
      reason: TwoFactorReminderReason.FirstSessions,
    })
  })

  /** An authenticator added elsewhere is not in the cached copy, so the bulletin waits
   *  for the fresh read rather than flash for an account that no longer owes it. */
  it("waits for the fresh read of the account before showing the bulletin", async () => {
    setAccount({ sats: 500_000, loading: true })
    const { result, rerender } = await renderEnforcement()
    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.FirstSessions)
    expect(result.current.shouldShowReminderBulletin).toBe(false)

    setAccount({ sats: 500_000, totpEnabled: true })
    await act(async () => rerender({}))

    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(result.current.reminderReason).toBeNull()
  })

  it("waits for this launch's thresholds before showing the bulletin", async () => {
    mockIsConfigFresh = false
    storeRecord({ highestTier: TwoFactorTier.Recommended })
    setAccount({ sats: 500_000 })
    const { result, rerender } = await renderEnforcement()
    expect(result.current.shouldShowReminderBulletin).toBe(false)

    mockIsConfigFresh = true
    await act(async () => rerender({}))

    expect(result.current.shouldShowReminderBulletin).toBe(true)
  })

  it("puts the bulletin away once a setup left unfinished counts the tier's dismissal", async () => {
    setAccount({ sats: 500_000 })
    const { result } = await renderEnforcement()

    act(() => result.current.registerDismissal(TwoFactorTier.Recommended))

    expect(result.current.shouldShowReminderBulletin).toBe(false)
  })

  it("brings the bulletin back at the next session start while its dismissals last", async () => {
    setAccount({ sats: 500_000 })
    const { result, rerender } = await renderEnforcement()
    act(() => result.current.dismissReminderBulletin())

    await loginAgain(rerender, { sats: 500_000 })

    expect(result.current.shouldShowReminderBulletin).toBe(true)
    expect(result.current.remainingDismissals).toBe(2)
  })

  it("stops the bulletin after three dismissals while no wallet is above its all-time high", async () => {
    pastFirstSessions({ highestSats: 800_000, highestUsdCents: 60_000 })
    setAccount({ sats: 700_000, usdCents: 50_000 })

    const { result } = await renderEnforcement()

    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(result.current.reminderReason).toBeNull()
    expect(result.current.isProtectionGateActive).toBe(false)
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("brings the bulletin back when the bitcoin wallet rises above its all-time high, and records the new high", async () => {
    pastFirstSessions({ highestSats: 800_000, highestUsdCents: 60_000 })
    setAccount({ sats: 800_001, usdCents: 0 })

    const { result } = await renderEnforcement()

    expect(result.current.shouldShowReminderBulletin).toBe(true)
    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(lastWrittenRecord()).toMatchObject({
      highestSats: 800_001,
      highestUsdCents: 60_000,
    })
  })

  it("brings the bulletin back when the dollar wallet rises above its all-time high", async () => {
    pastFirstSessions({ highestSats: 800_000, highestUsdCents: 60_000 })
    setAccount({ sats: 0, usdCents: 60_100 })

    const { result } = await renderEnforcement()

    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(lastWrittenRecord()).toMatchObject({
      highestSats: 800_000,
      highestUsdCents: 60_100,
    })
  })

  /** The new high is settled when the bulletin is closed, so one never closed comes
   *  back, at a lower balance too, as long as it is still above the high before it. */
  it("brings a new-high bulletin back at every session start until it is closed", async () => {
    pastFirstSessions({ highestSats: 600_000 })
    setAccount({ sats: 900_000 })
    const { result, rerender } = await renderEnforcement()
    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(lastWrittenRecord()).toMatchObject({
      highestSats: 900_000,
      isNewHighPending: true,
    })

    await loginAgain(rerender, { sats: 800_000 })
    expect(result.current.shouldShowReminderBulletin).toBe(true)
    expect(result.current.reminderReason).toBe(TwoFactorReminderReason.NewAllTimeHigh)

    act(() => result.current.dismissReminderBulletin())
    expect(lastWrittenRecord().isNewHighPending).toBe(false)
    await loginAgain(rerender, { sats: 850_000 })

    expect(result.current.shouldShowReminderBulletin).toBe(false)
  })

  /** Adding the authenticator from the bulletin's setup counts no dismissal; the next
   *  session start, owing nothing, settles the high it was reminding of. */
  it("settles a pending new high once the account holds an authenticator", async () => {
    pastFirstSessions({ highestSats: 900_000, isNewHighPending: true })
    setAccount({ sats: 900_000, totpEnabled: true })

    await renderEnforcement()

    expect(lastWrittenRecord()).toMatchObject({
      highestSats: 900_000,
      isNewHighPending: false,
    })
  })

  /** Crossing into the tier is no new high: the crossing seeds the highs, and the first
   *  sessions bring the bulletin back on their own. */
  it("leaves no new high pending when the session start is the one that crossed into the tier", async () => {
    storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })
    setAccount({ sats: 600_000 })

    await renderEnforcement()

    expect(lastWrittenRecord()).toMatchObject({
      highestTier: TwoFactorTier.Recommended,
      highestSats: 600_000,
      isNewHighPending: false,
    })
  })

  it("waits for the next high once the bulletin a high brought back is waved away", async () => {
    pastFirstSessions({ highestSats: 800_000 })
    setAccount({ sats: 900_000 })
    const { result, rerender } = await renderEnforcement()
    expect(result.current.shouldShowReminderBulletin).toBe(true)

    act(() => result.current.dismissReminderBulletin())
    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(lastWrittenRecord().recommendedDismissals).toBe(4)

    await loginAgain(rerender, { sats: 900_000 })

    expect(result.current.shouldShowReminderBulletin).toBe(false)
  })

  /** The all-time high is the highest balance seen at a session start: a balance that
   *  rises later in the session waits for the next one. */
  it("reads the highs once, when the fresh read lands, and not for a balance that rises later in the session", async () => {
    pastFirstSessions({ highestSats: 800_000 })
    setAccount({ sats: 900_000, loading: true })
    const { result, rerender } = await renderEnforcement()
    expect(result.current.shouldShowReminderBulletin).toBe(false)

    setAccount({ sats: 700_000 })
    await act(async () => rerender({}))
    expect(result.current.shouldShowReminderBulletin).toBe(false)

    setAccount({ sats: 900_000 })
    await act(async () => rerender({}))

    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  /** Above the recommended tier the bulletin never comes back, so there is no high to
   *  keep reading. */
  it("reads no all-time high above the recommended tier", async () => {
    storeRecord({ highestTier: TwoFactorTier.Enforced, highestSats: 5_000_000 })
    setAccount({ sats: 6_000_000 })

    await renderEnforcement()

    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("keeps the highs current at the suggested tier's session starts", async () => {
    storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })
    setAccount({ sats: 80_000, usdCents: 4_000 })

    await renderEnforcement()

    expect(lastWrittenRecord()).toMatchObject({
      highestTier: TwoFactorTier.Suggested,
      highestSats: 80_000,
      highestUsdCents: 4_000,
    })
  })

  /** The highs follow the tier reached, not the one owed: removing the authenticator
   *  later measures the balance against what the sessions saw while it was held. */
  it("keeps the highs current while the account holds an authenticator", async () => {
    pastFirstSessions({ highestSats: 600_000 })
    setAccount({ sats: 2_000_000, totpEnabled: true })
    const withAuthenticator = await renderEnforcement()
    expect(withAuthenticator.result.current.shouldShowReminderBulletin).toBe(false)
    const keptRecord = lastWrittenRecord()
    expect(keptRecord.highestSats).toBe(2_000_000)
    withAuthenticator.unmount()

    storeRecord(keptRecord)
    setAccount({ sats: 2_000_000, totpEnabled: false })
    const { result } = await renderEnforcement()

    expect(result.current.unmetTier).toBe(TwoFactorTier.Recommended)
    expect(result.current.shouldShowReminderBulletin).toBe(false)
  })

  /** However far the balance falls after the crossing, a session start below the
   *  balance that raised the tier is no new high. */
  it("takes the balance that raised the tier mid-session as the first all-time high", async () => {
    storeRecord({ highestTier: TwoFactorTier.Suggested })
    setAccount({ sats: 400_000 })
    const crossed = await renderEnforcement()

    setAccount({ sats: 600_000 })
    await act(async () => crossed.rerender({}))
    expect(lastWrittenRecord()).toMatchObject({
      highestTier: TwoFactorTier.Recommended,
      highestSats: 600_000,
    })
    const crossedRecord = lastWrittenRecord()
    crossed.unmount()

    storeRecord({ ...crossedRecord, recommendedDismissals: 3 })
    setAccount({ sats: 150_000 })
    const { result } = await renderEnforcement()

    expect(result.current.shouldShowReminderBulletin).toBe(false)
    expect(result.current.reminderReason).toBeNull()
  })

  /** A record from before the highs were kept holds the tier with no highs: its first
   *  session start seeds them, so the bulletin's last dismissal is not undone by a
   *  balance that never moved. */
  it("seeds the highs at a first session start, so a later one at the same balance reads no new high", async () => {
    storeRecord({ highestTier: TwoFactorTier.Recommended, recommendedDismissals: 2 })
    setAccount({ sats: 600_000 })
    const { result, rerender } = await renderEnforcement()
    expect(lastWrittenRecord()).toMatchObject({ highestSats: 600_000 })

    act(() => result.current.dismissReminderBulletin())
    await loginAgain(rerender, { sats: 600_000 })

    expect(result.current.remainingDismissals).toBe(0)
    expect(result.current.shouldShowReminderBulletin).toBe(false)
  })

  /** A second tap that lands before the bulletin goes is no second dismissal. */
  it("counts and reports a double tap on the X as one dismissal", async () => {
    setAccount({ sats: 500_000 })
    const { result } = await renderEnforcement()
    const { dismissReminderBulletin } = result.current

    act(() => {
      dismissReminderBulletin()
      dismissReminderBulletin()
    })

    expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledTimes(1)
    expect(lastWrittenRecord().recommendedDismissals).toBe(1)
  })

  it("leaves the bulletin's X alone while the bulletin is not due", async () => {
    setAccount({ sats: 50_000 })
    storeRecord({ highestTier: TwoFactorTier.Suggested, highestSats: 50_000 })
    const { result } = await renderEnforcement()

    act(() => result.current.dismissReminderBulletin())

    expect(mockLogTwoFactorPromptDismissed).not.toHaveBeenCalled()
    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("reports the bulletin's reason with its impression", async () => {
    setAccount({ sats: 500_000 })
    const { result } = await renderEnforcement()

    act(() =>
      result.current.markPromptShown(
        TwoFactorPrompt.ReminderBulletin,
        TwoFactorReminderReason.FirstSessions,
      ),
    )

    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      prompt: TwoFactorPrompt.ReminderBulletin,
      reason: TwoFactorReminderReason.FirstSessions,
    })
  })

  /** A logout ends the session: the same account's next login is a new one, where the
   *  bulletin is due again and is a new impression. */
  it("reports the bulletin as shown again after logging out and back in to the same account", async () => {
    setAccount({ sats: 500_000 })
    const { result, rerender } = await renderEnforcement()
    const showBulletin = () =>
      act(() =>
        result.current.markPromptShown(
          TwoFactorPrompt.ReminderBulletin,
          TwoFactorReminderReason.FirstSessions,
        ),
      )
    showBulletin()

    mockIsAuthed = false
    rerender({})
    mockIsAuthed = true
    await act(async () => rerender({}))
    showBulletin()

    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(2)
  })
})
