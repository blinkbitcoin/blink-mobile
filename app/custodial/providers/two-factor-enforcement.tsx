import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useSettingsScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useMigrateNowRemedy } from "@app/screens/account-migration/hooks/use-migrate-now-prompt"
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
  /** The tier of a prompt waved away while the fresh read of the account was still
   *  out, None for none: whether that takes the session start is decided once the
   *  read lands, since the read may raise a prompt the dismissal does not cover. */
  dismissedTier: TwoFactorTier
}

const INITIAL_SESSION: SessionState = {
  accountId: null,
  isStartPending: false,
  countedTier: TwoFactorTier.None,
  dismissedTier: TwoFactorTier.None,
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
  /** The tier the account still owes, None once it holds an authenticator. */
  unmetTier: TwoFactorTier
  hasAuthenticator: boolean
  missingMethod: TwoFactorMethod
  /** An address the account holds but never verified. It cannot be registered again as
   *  new, so the setup has to send it through re-verification instead. */
  unverifiedEmail: string | null
  /** The wallet the high-balance copy names, meaningful at the high-balance tier. */
  highBalanceCurrency: WalletCurrency
  remainingDismissals: number
  /** The prompt the unmet tier calls for at a session start, None once the account
   *  complies. */
  requiredPrompt: TwoFactorSessionPrompt
  /** Whether this session's start is still to be acted on: the account's state is
   *  decided and no surface has taken the session start yet. */
  isSessionStartPending: boolean
  /** The account's record is still being read: nothing is decided for the session
   *  start, and a home that has not shown yet waits rather than show before a prompt
   *  that replaces it. */
  isPreparingSessionStart: boolean
  /** The full-screen prompt stands in for the home: shown in its place for the session
   *  start that owes it, until a dismissal takes that start or the account complies.
   *  Off while the wind-down's push into the migration applies, which outranks it. */
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
  hasAuthenticator: false,
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
  /** The wind-down's push into the migration, which the full-screen prompt yields to,
   *  from the same read the home shows the push from. */
  const migrateNowRemedy = useMigrateNowRemedy()

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
          dismissedTier: TwoFactorTier.None,
        })
      })
      .catch((err) => {
        if (!isMounted) return
        reportError("Two-factor enforcement read", err)
        /** Nothing to start, stated as such even though an unloaded record already
         *  keeps the start from being pending: the session says what it means. */
        commitSession({
          accountId,
          isStartPending: false,
          countedTier: TwoFactorTier.None,
          dismissedTier: TwoFactorTier.None,
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
  const missingMethod = resolveMissingMethod({ hasVerifiedEmail: isEmailVerified })
  const hasUnverifiedEmail = emailAddress !== null && !isEmailVerified
  const unverifiedEmail = hasUnverifiedEmail ? emailAddress : null

  const isEnforced = isEnabled && isLoadedForAccount
  const unmetTier = isEnforced
    ? resolveUnmetTier({ tier, hasAuthenticator })
    : TwoFactorTier.None
  const dismissalsLeft = remainingDismissals(record, unmetTier)
  const requiredPrompt = resolveSessionPrompt({ unmetTier, record })
  /** The local read decides first: the stored tier never lowers and the cached factors
   *  are what the account last showed, so a prompt they already call for goes up on the
   *  first frame. Only a local read that owes nothing waits for the fresh one, which can
   *  still raise the tier from a balance that moved elsewhere. */
  const hasLocalPrompt = requiredPrompt !== TwoFactorSessionPrompt.None
  const isSessionStartDecided = hasLocalPrompt || !isReadingAccount
  /** A dismissal the fresh read has yet to judge has already answered the prompt as
   *  far as every surface is concerned: nothing shows for the start until the read
   *  lands and either takes the start or raises the prompt the dismissal fell short of. */
  const isDismissalAwaitingRead = session.dismissedTier !== TwoFactorTier.None
  const isSessionStartPending =
    isEnforced &&
    isSessionForAccount &&
    session.isStartPending &&
    isSessionStartDecided &&
    !isDismissalAwaitingRead
  /** The record of this account is still being read: nothing is decided yet, and a home
   *  that has not shown yet does not show for the frames that read takes. */
  const isPreparingSessionStart = isEnabled && accountId !== null && !isSessionForAccount
  /** The full-screen prompt replaces the home for the session start that owes it, until
   *  a dismissal takes that start or the account complies. The wind-down's push into
   *  the migration outranks it, as it does the modal on the home: an account whose
   *  custodial service is ending has one remedy that matters more than a second factor,
   *  and that push lives on the home, which the prompt would stand in for. The push's
   *  session dismissal is the home's own, so the prompt yields for as long as the push
   *  applies, and the home then takes the start with no prompt. The prompt goes up from
   *  the local read at once rather than wait for the wind-down's answer, which a
   *  network that never answers would hold forever; should the answer then say the push
   *  applies, the prompt yields to it. */
  const isProtectionGateOwed =
    isSessionStartPending && requiredPrompt === TwoFactorSessionPrompt.ProtectionRequired
  const isProtectionGateActive = isProtectionGateOwed && !migrateNowRemedy.isDue

  /** The card belongs to the nudge tier alone: from the reminder tier on, the session
   *  prompt is the one asking, and the home never stacks two. The banner asks at every
   *  tier until the account holds an authenticator. */
  const shouldShowNudgeCard =
    unmetTier === TwoFactorTier.Nudge && !record.nudgeCardDismissed
  const shouldShowSettingsBanner = unmetTier !== TwoFactorTier.None

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

  /** The read as last committed, for a dismissal reported by a handler bound to an
   *  earlier render, as the hardware back's can be in the frames between a commit and
   *  its effects: the dismissal is judged by what the account owes now, not by what it
   *  owed when the handler was bound, so no commit shows the home in between. */
  const latestReadRef = useRef({ isReadingAccount, unmetTier, isSessionStartDecided })
  useLayoutEffect(() => {
    latestReadRef.current = { isReadingAccount, unmetTier, isSessionStartDecided }
  })

  /** A dismissal takes the session start when the prompt waved away is the one the
   *  start owes, counted or not: on the home or on a flow the prompt opened, the home
   *  must not raise it again on the way back. A start that a fresher read has since
   *  made owe a higher tier's prompt is kept for that prompt. While the fresh read is
   *  still out, a prompt raised from the local read can be waved away before the read
   *  says whether the account owes more: the dismissal is kept until it lands, and
   *  judged then by the effect below, so a balance that crossed into a higher tier
   *  elsewhere still gets that tier's prompt this session. What is kept is the highest
   *  tier waved away, so a lower one reported after it, or the no prompt the modal's
   *  closing frames report, cannot replace it and raise the prompt again. */
  const registerDismissal = useCallback(
    (promptTier: TwoFactorTier) => {
      if (promptTier === TwoFactorTier.None) return
      const latest = latestSessionRef.current
      const read = latestReadRef.current
      const isSessionAccount = accountId !== null && latest.accountId === accountId
      if (!isSessionAccount) return
      const isCountable =
        promptTier >= TwoFactorTier.Reminder && promptTier > latest.countedTier
      const isStartOwedToPrompt =
        read.isSessionStartDecided && promptTier >= read.unmetTier
      const isStartAwaitingRead = latest.isStartPending && read.isReadingAccount
      const isStartTaken =
        latest.isStartPending && isStartOwedToPrompt && !isStartAwaitingRead
      const isHigherThanKept = promptTier > latest.dismissedTier
      const isKeptForRead = isStartAwaitingRead && isHigherThanKept
      if (!isCountable && !isStartTaken && !isKeptForRead) return
      if (isCountable) persist((current) => withDismissal(current, promptTier))
      commitSession({
        accountId,
        isStartPending: latest.isStartPending && !isStartTaken,
        countedTier: isCountable ? promptTier : latest.countedTier,
        dismissedTier: isKeptForRead ? promptTier : latest.dismissedTier,
      })
    },
    [accountId, persist, commitSession],
  )

  /** Judges a dismissal made while the fresh read was out, once it has landed: the
   *  start is taken if the prompt waved away still covers what the account owes, and
   *  kept for the escalated prompt otherwise. A read that failed lands as what the
   *  account last read as, which the dismissal covered. The dismissal itself is among
   *  what wakes the judging, so none can wait on a change that is not coming. */
  useEffect(() => {
    const latest = latestSessionRef.current
    const isSessionAccount = accountId !== null && latest.accountId === accountId
    const isDismissalDue =
      latest.dismissedTier !== TwoFactorTier.None && !isReadingAccount
    if (!isSessionAccount || !isDismissalDue) return
    const isCovered = latest.dismissedTier >= unmetTier
    commitSession({
      ...latest,
      isStartPending: latest.isStartPending && !isCovered,
      dismissedTier: TwoFactorTier.None,
    })
  }, [accountId, isReadingAccount, unmetTier, session.dismissedTier, commitSession])

  const contextValue = useMemo(
    () => ({
      tier,
      unmetTier,
      hasAuthenticator,
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
      hasAuthenticator,
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
