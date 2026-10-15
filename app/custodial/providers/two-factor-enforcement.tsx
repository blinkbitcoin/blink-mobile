import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useSettingsScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorPrompt,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import { AccountType } from "@app/types/wallet"
import {
  logTwoFactorPromptDismissed,
  logTwoFactorPromptShown,
} from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { loadJsonOrThrow, saveJson } from "@app/utils/storage"

import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  hasTwoFactor,
  normalizeStoredRecord,
  remainingDismissals,
  resolveBalanceTier,
  resolveMissingMethod,
  resolveSessionPrompt,
  resolveUnmetTier,
  withDismissal,
  withTierReached,
} from "../two-factor-enforcement"

const STORAGE_KEY_PREFIX = "twoFactorEnforcement"

const storageKeyFor = (accountId: string): string => `${STORAGE_KEY_PREFIX}:${accountId}`

type StoredState = {
  accountId: string | null
  record: TwoFactorEnforcementRecord
}

const INITIAL_STORED: StoredState = {
  accountId: null,
  record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
}

/**
 * What this session has already done for the account, kept in memory on purpose: a
 * session is a cold launch or a fresh login, and both give this provider a fresh
 * account to load, while a return from the background gives it nothing new.
 */
type SessionState = {
  accountId: string | null
  isStartPending: boolean
  /** The highest tier whose prompt was waved away this session, None for none yet: a
   *  tier counts one dismissal per session, and a higher tier's prompt raised later in
   *  the same session, by a fresher read, counts its own. */
  countedTier: TwoFactorTier
}

const INITIAL_SESSION: SessionState = {
  accountId: null,
  isStartPending: false,
  countedTier: TwoFactorTier.None,
}

type RecordUpdate = (record: TwoFactorEnforcementRecord) => TwoFactorEnforcementRecord

/** The prompts reported as shown this session, by prompt and tier, for the account
 *  they were shown to. */
type ShownPrompts = {
  accountId: string | null
  impressions: Set<string>
}

export type TwoFactorEnforcementState = {
  tier: TwoFactorTier
  /** The highest tier whose condition the account still fails, None once it complies. */
  unmetTier: TwoFactorTier
  hasTwoFactor: boolean
  missingMethod: TwoFactorMethod
  /** An address the account holds but never verified. It cannot be registered again as
   *  new, so the setup has to send it through re-verification instead. */
  unverifiedEmail: string | null
  /** The wallet the high-balance copy names, meaningful at the authenticator tier. */
  highBalanceCurrency: WalletCurrency
  remainingDismissals: number
  /** The prompt the unmet tier calls for at a session start, None once the account
   *  complies. */
  requiredPrompt: TwoFactorSessionPrompt
  /** Whether this session's start is still to be acted on: the account's state is
   *  decided and no surface has taken the session start yet. */
  isSessionStartPending: boolean
  /** The account's record is still being read: nothing is decided for the session
   *  start, and the home must wait rather than show before a prompt that replaces it. */
  isPreparingSessionStart: boolean
  /** The full-screen prompt stands in for the home: shown in its place for the session
   *  start that owes it, until a dismissal takes that start or the account complies. */
  isProtectionGateActive: boolean
  shouldShowNudgeCard: boolean
  shouldShowSettingsBanner: boolean
  /** Reports a prompt as shown, once per session for each tier it is shown at: a
   *  surface mounts again on every visit, and that is no new impression. */
  markPromptShown: (prompt: TwoFactorPrompt) => void
  dismissNudgeCard: () => void
  /** Takes the session start, whether or not it owed a prompt: what the balance does
   *  later in the session waits for the next one. */
  consumeSessionStart: () => void
  /** Counts a prompt of the given tier waved away, at most once per session, and takes
   *  the session start: the surface that raised the prompt is done asking for it. */
  registerDismissal: (tier: TwoFactorTier) => void
}

const INERT_STATE: TwoFactorEnforcementState = {
  tier: TwoFactorTier.None,
  unmetTier: TwoFactorTier.None,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email,
  unverifiedEmail: null,
  highBalanceCurrency: WalletCurrency.Btc,
  remainingDismissals: 0,
  requiredPrompt: TwoFactorSessionPrompt.None,
  isSessionStartPending: false,
  isPreparingSessionStart: false,
  isProtectionGateActive: false,
  shouldShowNudgeCard: false,
  shouldShowSettingsBanner: false,
  markPromptShown: () => {},
  dismissNudgeCard: () => {},
  consumeSessionStart: () => {},
  registerDismissal: () => {},
}

const TwoFactorEnforcementContext = createContext<TwoFactorEnforcementState>(INERT_STATE)

export const useTwoFactorEnforcement = (): TwoFactorEnforcementState =>
  useContext(TwoFactorEnforcementContext)

/**
 * Decides which two-factor prompts the active custodial account gets from its balance,
 * once for every surface that shows one, so a dismissal on the home is already known
 * to the settings. The tier only ever rises and is remembered per account outside the
 * persistent state, which a logout resets: a dismissal must survive logging back in.
 * The stored record is keyed to the account it was read for, so switching accounts
 * never shows one account's prompts from the other's record.
 */
export const TwoFactorEnforcementProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { isAtLeastLevelOne } = useLevel()
  const { activeAccount } = useAccountRegistry()
  const { custodialTwoFactorEnforcementEnabled } = useRemoteConfig()
  const [stored, setStored] = useState<StoredState>(INITIAL_STORED)
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION)
  /** The record and the session as last written, so two writes in the same pass build
   *  on each other: a dismissal and a tier raise that land together must both survive,
   *  and two dismissals that land together must still count as one. */
  const latestStoredRef = useRef<StoredState>(INITIAL_STORED)
  const latestSessionRef = useRef<SessionState>(INITIAL_SESSION)
  const shownPromptsRef = useRef<ShownPrompts>({
    accountId: null,
    impressions: new Set(),
  })

  /** The account's registered type rather than the wallet state, so the answer holds
   *  steady through the self-custodial cold-start window while the SDK connects. */
  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial
  /** A trial account adds no factor: the settings offer it no login methods, and it
   *  upgrades through the phone login instead, so it is not prompted. */
  const isEnabled =
    custodialTwoFactorEnforcementEnabled &&
    isAuthed &&
    isAtLeastLevelOne &&
    !isSelfCustodialAccount

  /** Each session reads the balances and the factors from the network: the persisted
   *  cache can carry a session-old balance, and a prompt decided from it would miss a
   *  threshold crossed elsewhere. Once answered, the session keeps the cached copy. */
  const { data, loading: isReadingAccount } = useSettingsScreenQuery({
    skip: !isEnabled,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  })
  /** Read through the gate, not only the skip: a skipped query may still hand back the
   *  answer it last had, and that answer belongs to a session this one must not act on. */
  const me = isEnabled ? data?.me : undefined
  const accountId = me?.defaultAccount.id ?? null

  const commitStored = useCallback((next: StoredState) => {
    latestStoredRef.current = next
    setStored(next)
  }, [])

  const commitSession = useCallback((next: SessionState) => {
    latestSessionRef.current = next
    setSession(next)
  }, [])

  useEffect(() => {
    if (!accountId) {
      commitStored(INITIAL_STORED)
      commitSession(INITIAL_SESSION)
      return
    }
    let isMounted = true
    /** A record that could not be read is not a missing one: with the account left
     *  unloaded, nothing is prompted and nothing is written, so a transient read
     *  failure cannot replace a dismissal or a reached tier with the defaults. The
     *  prompts stay off for that launch; the next one reads the record again. The
     *  session is still marked as this account's, with nothing to start, so no
     *  surface waits on a start that will never be decided. */
    loadJsonOrThrow(storageKeyFor(accountId))
      .then((raw) => {
        if (!isMounted) return
        commitStored({ accountId, record: normalizeStoredRecord(raw) })
        commitSession({
          accountId,
          isStartPending: true,
          countedTier: TwoFactorTier.None,
        })
      })
      .catch((err) => {
        if (!isMounted) return
        reportError("Two-factor enforcement read", err)
        commitSession({
          accountId,
          isStartPending: false,
          countedTier: TwoFactorTier.None,
        })
      })
    return () => {
      isMounted = false
    }
  }, [accountId, commitStored, commitSession])

  /** Writes through the record, once this account's is loaded; tells whether it did. */
  const persist = useCallback(
    (update: RecordUpdate): boolean => {
      const latest = latestStoredRef.current
      if (!accountId || latest.accountId !== accountId) return false
      const record = update(latest.record)
      commitStored({ accountId, record })
      saveJson(storageKeyFor(accountId), record).catch((err) =>
        reportError("Two-factor enforcement write", err),
      )
      return true
    },
    [accountId, commitStored],
  )

  const isLoadedForAccount = accountId !== null && stored.accountId === accountId
  const isSessionForAccount = accountId !== null && session.accountId === accountId
  /** Only this account's record counts: while the next account's is still being read,
   *  the previous one's tier must not leak into the context or the events. */
  const record = isLoadedForAccount ? stored.record : DEFAULT_TWO_FACTOR_ENFORCEMENT
  const wallets = me?.defaultAccount.wallets
  const balanceTier = resolveBalanceTier(wallets)
  const tier = balanceTier > record.highestTier ? balanceTier : record.highestTier

  useEffect(() => {
    if (!isLoadedForAccount || balanceTier <= record.highestTier) return
    persist((current) => withTierReached(current, balanceTier, wallets))
  }, [isLoadedForAccount, balanceTier, record.highestTier, wallets, persist])

  const emailAddress = me?.email?.address ?? null
  const isEmailVerified = Boolean(me?.email?.verified)
  const hasAuthenticator = Boolean(me?.totpEnabled)
  const factors = {
    hasPhone: Boolean(me?.phone),
    hasVerifiedEmail: isEmailVerified,
    hasAuthenticator,
  }
  const isTwoFactorSet = hasTwoFactor(factors)
  const missingMethod = resolveMissingMethod(factors)
  const hasUnverifiedEmail = emailAddress !== null && !isEmailVerified
  const unverifiedEmail = hasUnverifiedEmail ? emailAddress : null

  const isEnforced = isEnabled && isLoadedForAccount
  const unmetTier = isEnforced
    ? resolveUnmetTier({ tier, hasTwoFactor: isTwoFactorSet, hasAuthenticator })
    : TwoFactorTier.None
  const dismissalsLeft = remainingDismissals(record, unmetTier)
  const requiredPrompt = resolveSessionPrompt({ unmetTier, record })
  /** The local read decides first: the stored tier never lowers and the cached factors
   *  are what the account last showed, so a prompt they already call for goes up on the
   *  first frame. Only a local read that owes nothing waits for the fresh one, which can
   *  still raise the tier from a balance that moved elsewhere. */
  const hasLocalPrompt = requiredPrompt !== TwoFactorSessionPrompt.None
  const isSessionStartDecided = hasLocalPrompt || !isReadingAccount
  const isSessionStartPending =
    isEnforced && isSessionForAccount && session.isStartPending && isSessionStartDecided
  /** The record of this account is still being read: nothing is decided yet, and the
   *  home must not show for the frames that read takes. */
  const isPreparingSessionStart = isEnabled && accountId !== null && !isSessionForAccount
  /** The full-screen prompt replaces the home for the session start that owes it, until
   *  a dismissal takes that start or the account complies. */
  const isProtectionGateActive =
    isSessionStartPending && requiredPrompt === TwoFactorSessionPrompt.ProtectionRequired

  /** The card belongs to the nudge tier alone: from the required tier on, the session
   *  prompt is the one asking, and the home never stacks two. The banner asks at every
   *  tier until the account holds two factors, since the setup it opens leads with the
   *  authenticator, which is what the highest tier asks for; an account that already
   *  holds two factors is asked for its authenticator by the session prompt alone. */
  const shouldShowNudgeCard =
    unmetTier === TwoFactorTier.Nudge && !record.nudgeCardDismissed
  const isUnmet = unmetTier !== TwoFactorTier.None
  const shouldShowSettingsBanner = isUnmet && !isTwoFactorSet

  /** Another account's impressions start afresh; the same account coming back through
   *  a gate that closed and opened again within the session keeps its own. With the
   *  gate closed there is no account to have shown a prompt to. */
  const markPromptShown = useCallback(
    (prompt: TwoFactorPrompt) => {
      if (!accountId) return
      const isAnotherAccount = shownPromptsRef.current.accountId !== accountId
      if (isAnotherAccount) {
        shownPromptsRef.current = { accountId, impressions: new Set() }
      }
      const { impressions } = shownPromptsRef.current
      const impression = `${prompt}:${tier}`
      if (impressions.has(impression)) return
      impressions.add(impression)
      logTwoFactorPromptShown({ tier, prompt })
    },
    [accountId, tier],
  )

  const dismissNudgeCard = useCallback(() => {
    const isDismissed = persist((current) => ({ ...current, nudgeCardDismissed: true }))
    if (isDismissed)
      logTwoFactorPromptDismissed({ tier, prompt: TwoFactorPrompt.HomeCard })
  }, [tier, persist])

  const consumeSessionStart = useCallback(() => {
    commitSession({ ...latestSessionRef.current, isStartPending: false })
  }, [commitSession])

  /** A dismissal takes the session start when the prompt waved away is the one the
   *  start owes, counted or not: on the home or on a flow the prompt opened, the home
   *  must not raise it again on the way back. A start that a fresher read has since
   *  made owe a higher tier's prompt is kept for that prompt, as is one the fresh read
   *  has not decided yet, which may still come to owe one. */
  const registerDismissal = useCallback(
    (promptTier: TwoFactorTier) => {
      const latest = latestSessionRef.current
      const isSessionAccount = accountId !== null && latest.accountId === accountId
      if (!isSessionAccount) return
      const isCountable =
        promptTier >= TwoFactorTier.Required && promptTier > latest.countedTier
      const isStartOwedToPrompt = isSessionStartDecided && promptTier >= unmetTier
      const isStartTaken = latest.isStartPending && isStartOwedToPrompt
      if (!isCountable && !isStartTaken) return
      if (isCountable) persist((current) => withDismissal(current, promptTier))
      commitSession({
        accountId,
        isStartPending: latest.isStartPending && !isStartTaken,
        countedTier: isCountable ? promptTier : latest.countedTier,
      })
    },
    [accountId, isSessionStartDecided, unmetTier, persist, commitSession],
  )

  const contextValue = useMemo(
    () => ({
      tier,
      unmetTier,
      hasTwoFactor: isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      highBalanceCurrency: record.highBalanceCurrency,
      remainingDismissals: dismissalsLeft,
      requiredPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
      consumeSessionStart,
      registerDismissal,
    }),
    [
      tier,
      unmetTier,
      isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      record.highBalanceCurrency,
      dismissalsLeft,
      requiredPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
      consumeSessionStart,
      registerDismissal,
    ],
  )

  return (
    <TwoFactorEnforcementContext.Provider value={contextValue}>
      {children}
    </TwoFactorEnforcementContext.Provider>
  )
}
