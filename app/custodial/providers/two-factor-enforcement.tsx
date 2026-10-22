import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import {
  FreshAccountRead,
  useFreshAccountRead,
} from "@app/custodial/hooks/use-fresh-account-read"
import { useSettingsScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useMigrateNowRemedy } from "@app/screens/account-migration/hooks/use-migrate-now-prompt"
import {
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorReminderReason,
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
  isHoldingHighBalance,
  normalizeStoredRecord,
  remainingDismissals,
  resolveBalanceTier,
  resolveHighBalanceCrossing,
  resolveReminderReason,
  resolveSessionPrompt,
  resolveUnmetTier,
} from "../two-factor-enforcement"
import {
  INITIAL_SESSION_STATE,
  SessionEffect,
  SessionRead,
  SessionStart,
  twoFactorSessionReducer,
} from "../two-factor-session"

const STORAGE_KEY_PREFIX = "twoFactorEnforcement"

const storageKeyFor = (accountId: string): string => `${STORAGE_KEY_PREFIX}:${accountId}`

/** Carries out what a transition left: a write, reported if it fails, or an event. */
const carryOut = (effect: SessionEffect) => {
  switch (effect.kind) {
    case "save":
      saveJson(storageKeyFor(effect.accountId), effect.record).catch((err) =>
        reportError("Two-factor enforcement write", err),
      )
      return
    case "promptShown":
      logTwoFactorPromptShown(effect.event)
      return
    case "promptDismissed":
      logTwoFactorPromptDismissed(effect.event)
  }
}

export type TwoFactorEnforcementState = {
  tier: TwoFactorTier
  /** The tier the account still owes, None once it holds an authenticator. */
  unmetTier: TwoFactorTier
  /** Whether the prompts apply to the active account: the console has them on, and the
   *  account is a custodial one from level one whose record is in. Off, the account owes
   *  nothing because nothing is asked of it, not because its balance is low. */
  isEnforced: boolean
  hasAuthenticator: boolean
  /** The wallet the high-balance copy names, meaningful at the high-balance tier. */
  highBalanceCurrency: WalletCurrency
  /** The threshold that copy quotes, in that wallet's unit. */
  highBalanceThreshold: number
  /** Whether that wallet still holds the threshold it crossed: the copy states the
   *  balance only while it is true. */
  isHoldingHighBalance: boolean
  remainingDismissals: number
  /** Whether the prompts may offer leaving custody: only once the console is known to
   *  have the self-custodial stack on, so nothing pushes the user toward a stack that is
   *  switched off, not even before this launch's fetch settles. */
  isCustodyExitOffered: boolean
  /** Whether leaving custody is known to be switched off: the high-balance modal then
   *  stays dismissible, spends none of its allowance and counts nothing down. Not yet
   *  known, neither this nor the offer holds. */
  isCustodyExitOff: boolean
  /** The prompt the unmet tier calls for at a session start, None once the account
   *  complies. */
  sessionPrompt: TwoFactorSessionPrompt
  /** Whether this session's start is still to be acted on: the account's state is
   *  decided and no surface has taken the session start yet. */
  isSessionStartPending: boolean
  /** The account's record is still being read: nothing is decided for the session
   *  start, and a home that has not shown yet waits rather than show before a prompt
   *  that replaces it. */
  isPreparingSessionStart: boolean
  /** The high-balance blocking screen stands in for the home: shown in its place for
   *  the session start that owes it, once the tier's modal has spent its dismissals,
   *  until the account complies. Off while the wind-down's push into the migration
   *  applies, which outranks it. */
  isProtectionGateActive: boolean
  shouldShowNudgeCard: boolean
  /** Why the reminder tier's bulletin is on the home, in the card's place, and null
   *  while it is not: due at every session start while the tier's dismissals last, then
   *  at each new all-time high, and gone for the session once waved away. It never
   *  blocks. The reason is what its events report. */
  reminderBulletinReason: TwoFactorReminderReason | null
  shouldShowSettingsBanner: boolean
  /** Reports a prompt as shown, once per session for each tier it is shown at: a
   *  surface mounts again on every visit, and that is no new impression. */
  markPromptShown: (prompt: TwoFactorPrompt, reason?: TwoFactorReminderReason) => void
  dismissNudgeCard: () => void
  /** The bulletin's X: one dismissal of the reminder tier, at most one per session. */
  dismissReminderBulletin: () => void
  /** Takes the session start, whether or not it owed a prompt: what the balance does
   *  later in the session waits for the next one. */
  consumeSessionStart: () => void
  /** Counts a prompt of the given tier waved away, at most once per session, and takes
   *  the session start: the surface that raised the prompt is done asking for it. A
   *  counted dismissal is reported as the given prompt's, once. */
  registerDismissal: (tier: TwoFactorTier, origin?: TwoFactorPromptOrigin) => void
}

const INERT_STATE: TwoFactorEnforcementState = {
  tier: TwoFactorTier.None,
  unmetTier: TwoFactorTier.None,
  isEnforced: false,
  hasAuthenticator: false,
  highBalanceCurrency: WalletCurrency.Btc,
  highBalanceThreshold: 0,
  isHoldingHighBalance: false,
  remainingDismissals: 0,
  isCustodyExitOffered: false,
  isCustodyExitOff: false,
  sessionPrompt: TwoFactorSessionPrompt.None,
  isSessionStartPending: false,
  isPreparingSessionStart: false,
  isProtectionGateActive: false,
  shouldShowNudgeCard: false,
  reminderBulletinReason: null,
  shouldShowSettingsBanner: false,
  markPromptShown: () => {},
  dismissNudgeCard: () => {},
  dismissReminderBulletin: () => {},
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
 * never shows one account's prompts from the other's record. Every change to the record
 * and the session goes through one reducer, so changes that land in the same pass build
 * on each other, and the writes and events they make are carried out after it.
 */
export const TwoFactorEnforcementProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { isAtLeastLevelOne } = useLevel()
  const { activeAccount } = useAccountRegistry()
  const {
    custodialTwoFactorEnforcementEnabled,
    custodialTwoFactorThresholds: thresholds,
  } = useRemoteConfig()
  const {
    remoteConfigReady: isConfigSettled,
    nonCustodialEnabled,
    isNonCustodialFlagSettled,
  } = useFeatureFlags()
  const [state, dispatch] = useReducer(twoFactorSessionReducer, INITIAL_SESSION_STATE)

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
  /** The wind-down's push into the migration, which the blocking screen yields to,
   *  from the same read the home shows the push from. */
  const migrateNowRemedy = useMigrateNowRemedy()
  const isCustodyExitOffered = isNonCustodialFlagSettled && nonCustodialEnabled
  /** Whether the device knows if leaving custody is on offer: the console's word is in,
   *  or this launch's fetch settled without it, which leaves the shipped default, off. */
  const isCustodyExitKnown = isNonCustodialFlagSettled || isConfigSettled
  const isCustodyExitOff = isCustodyExitKnown && !isCustodyExitOffered

  /** The account is read from the cache, which every reader shares; each session reads
   *  it fresh from the network into that cache, and says whether it did. The persisted
   *  cache can carry a session-old balance, and a prompt decided from it would miss a
   *  threshold crossed elsewhere. */
  const { data } = useSettingsScreenQuery({ skip: !isEnabled, fetchPolicy: "cache-only" })
  const freshRead = useFreshAccountRead(isEnabled)
  const isReadingAccount = freshRead === FreshAccountRead.Pending
  /** Read through the gate, not only the skip: a skipped query may still hand back the
   *  answer it last had, and that answer belongs to a session this one must not act on. */
  const me = isEnabled ? data?.me : undefined
  const accountId = me?.defaultAccount.id ?? null
  /** The fresh read is the account from the network and the thresholds once this
   *  launch's console fetch has settled. Until then, the thresholds are what an earlier
   *  launch activated, and a tier raised from them would stay raised once the console's
   *  new ones land, since a reached tier never lowers. The fetch settles whether or not
   *  it succeeds: offline, the thresholds an earlier launch activated are the ones. */
  const isAwaitingFreshRead = isReadingAccount || !isConfigSettled
  /** A read that fails lands as what the account last read as: the session can decide
   *  from it, but nothing is written from it, since a tier reached never lowers and a
   *  high only rises. What the network has confirmed is what the record keeps. */
  const isReadConfirmed = freshRead === FreshAccountRead.Confirmed
  const isBalanceConfirmed = isConfigSettled && isReadConfirmed

  useEffect(() => {
    dispatch({ type: "accountChanged", accountId })
    if (!accountId) return
    let isMounted = true
    /** A record that could not be read leaves the prompts off for that launch; the next
     *  one reads the record again. */
    loadJsonOrThrow(storageKeyFor(accountId))
      .then((raw) => {
        if (!isMounted) return
        dispatch({ type: "recordLoaded", accountId, record: normalizeStoredRecord(raw) })
      })
      .catch((err) => {
        if (!isMounted) return
        reportError("Two-factor enforcement read", err)
        dispatch({ type: "recordUnreadable", accountId })
      })
    return () => {
      isMounted = false
    }
  }, [accountId])

  /** The writes and events the transitions left, carried out once each, in order. */
  useEffect(() => {
    if (state.outbox.length === 0) return
    state.outbox.forEach(carryOut)
    dispatch({ type: "outboxDrained", count: state.outbox.length })
  }, [state.outbox])

  const isStateForAccount = accountId !== null && state.accountId === accountId
  /** Only this account's record counts: while the next account's is still being read,
   *  the previous one's tier must not leak into the context or the events. */
  const loadedRecord = isStateForAccount ? state.record : null
  const isLoadedForAccount = loadedRecord !== null
  const isSessionStarted = state.start !== SessionStart.Preparing
  const isSessionForAccount = isStateForAccount && isSessionStarted
  const record = loadedRecord ?? DEFAULT_TWO_FACTOR_ENFORCEMENT
  const wallets = me?.defaultAccount.wallets
  /** No tier is read from a balance or thresholds that may be stale: the persisted cache
   *  answers before the network, and can hold a balance the account no longer has. A
   *  tier raised from it, and the high seeded with it, would stay. Until the fresh read
   *  lands, the stored tier alone stands; a read that fails lands as what the account
   *  last read as, which is then all there is to decide from. */
  const balanceTier = isAwaitingFreshRead
    ? TwoFactorTier.None
    : resolveBalanceTier(wallets, thresholds)
  const tier = balanceTier > record.highestTier ? balanceTier : record.highestTier

  const isTierRaised = balanceTier > record.highestTier
  const isRaiseDue = isLoadedForAccount && isBalanceConfirmed && isTierRaised
  useEffect(() => {
    if (!isRaiseDue || !accountId) return
    dispatch({
      type: "tierReached",
      accountId,
      tier: balanceTier,
      crossing: resolveHighBalanceCrossing(wallets, thresholds),
      wallets,
    })
  }, [isRaiseDue, accountId, balanceTier, wallets, thresholds])

  const hasAuthenticator = Boolean(me?.totpEnabled)

  const isEnforced = isEnabled && isLoadedForAccount
  const unmetTier = isEnforced
    ? resolveUnmetTier({ tier, hasAuthenticator })
    : TwoFactorTier.None
  const dismissalsLeft = remainingDismissals(record, unmetTier)
  const sessionPrompt = resolveSessionPrompt({ unmetTier, record, isCustodyExitOffered })
  /** The local read decides first: the stored tier never lowers and the cached
   *  authenticator is what the account last showed, so a prompt they already call for
   *  goes up on the first frame. Only a local read that owes nothing waits for the fresh
   *  one, which can still raise the tier from a balance that moved elsewhere. */
  const hasLocalPrompt = sessionPrompt !== TwoFactorSessionPrompt.None
  /** With the high-balance dismissals spent, whether the blocking screen or the modal is
   *  owed turns on whether leaving custody is on offer: until the device knows, nothing
   *  is decided, since a modal waved away in that window would take the start the
   *  blocking screen is owed. */
  const isHighBalanceSpent =
    unmetTier === TwoFactorTier.HighBalance && dismissalsLeft === 0
  const isAwaitingCustodyExit = isHighBalanceSpent && !isCustodyExitKnown
  const isReadDecided = hasLocalPrompt || !isAwaitingFreshRead
  const isSessionStartDecided = isReadDecided && !isAwaitingCustodyExit
  /** A dismissal the fresh read has yet to judge has already answered the prompt as
   *  far as every surface is concerned: nothing shows for the start until the read
   *  lands and either takes the start or raises the prompt the dismissal fell short of. */
  const isDismissalAwaitingRead = state.dismissedTier !== TwoFactorTier.None
  const isSessionStartPending =
    isEnforced &&
    isSessionForAccount &&
    state.start === SessionStart.Owed &&
    isSessionStartDecided &&
    !isDismissalAwaitingRead
  /** The record of this account is still being read, or the start waits to know which
   *  blocking prompt it owes: nothing is decided yet, and a home that has not shown yet
   *  does not show for the frames that takes. */
  const isReadingRecord = isEnabled && accountId !== null && !isSessionForAccount
  const isPreparingSessionStart = isReadingRecord || isAwaitingCustodyExit
  /** The blocking screen replaces the home for the session start that owes it, until
   *  the account complies. The wind-down's push into the migration outranks it, as it
   *  does the modal on the home: an account whose custodial service is ending has one
   *  remedy that matters more than a second factor, and that push lives on the home,
   *  which the screen would stand in for. The push's session dismissal is the home's
   *  own, so the screen yields for as long as the push applies, and the home then takes
   *  the start with no prompt. The screen goes up from the local read at once rather
   *  than wait for the wind-down's answer, which a network that never answers would
   *  hold forever; should the answer then say the push applies, the screen yields to
   *  it. */
  const isProtectionGateOwed =
    isSessionStartPending && sessionPrompt === TwoFactorSessionPrompt.ProtectionRequired
  const isProtectionGateActive = isProtectionGateOwed && !migrateNowRemedy.isDue

  /** The card belongs to the nudge tier alone: from the reminder tier on, that tier's
   *  own prompt asks instead, and the home never stacks two. The banner asks at every
   *  tier until the account holds an authenticator. */
  const isNudgeCardClosed = record.nudgeCardDismissed || state.isNudgeCardHidden
  const shouldShowNudgeCard = unmetTier === TwoFactorTier.Nudge && !isNudgeCardClosed
  const shouldShowSettingsBanner = unmetTier !== TwoFactorTier.None

  /** The reminder bulletin takes the card's place at the reminder tier, whether or not
   *  the card was closed, once the fresh read confirms the account still owes it: an
   *  authenticator added elsewhere is not in the cached copy. A dismissal of the tier
   *  this session, from the bulletin or from a setup left unfinished, puts it away until
   *  the next session start. */
  const reminderReason = resolveReminderReason({ unmetTier, record })
  const isReminderWavedAway = state.countedTier >= TwoFactorTier.Reminder
  const isReminderDue =
    reminderReason !== null && isSessionForAccount && !isAwaitingFreshRead
  const isReminderBulletinShown = isReminderDue && !isReminderWavedAway
  const reminderBulletinReason = isReminderBulletinShown ? reminderReason : null

  /** A logout ends the session, so a fresh login starts its impressions afresh, for
   *  the same account too: its prompts are due again and are new impressions. */
  useEffect(() => {
    if (!isAuthed) dispatch({ type: "impressionsReset" })
  }, [isAuthed])

  /** With the gate closed there is no account to have shown a prompt to. */
  const markPromptShown = useCallback(
    (prompt: TwoFactorPrompt, reason?: TwoFactorReminderReason) => {
      if (!accountId) return
      dispatch({ type: "promptShown", accountId, prompt, tier, reason })
    },
    [accountId, tier],
  )

  const dismissNudgeCard = useCallback(() => {
    if (!accountId) return
    dispatch({ type: "nudgeCardDismissed", accountId, tier })
  }, [accountId, tier])

  const consumeSessionStart = useCallback(() => {
    dispatch({ type: "sessionStartTaken" })
  }, [])

  /** The read as last committed, for a dismissal reported by a handler bound to an
   *  earlier render, as the hardware back's can be in the frames between a commit and
   *  its effects: the dismissal is judged by what the account owes now, not by what it
   *  owed when the handler was bound, so no commit shows the home in between. */
  const latestReadRef = useRef<SessionRead>({
    isAwaitingFreshRead,
    unmetTier,
    sessionPrompt,
    isSessionStartDecided,
    isCustodyExitOff,
  })
  useLayoutEffect(() => {
    latestReadRef.current = {
      isAwaitingFreshRead,
      unmetTier,
      sessionPrompt,
      isSessionStartDecided,
      isCustodyExitOff,
    }
  })

  const registerDismissal = useCallback(
    (promptTier: TwoFactorTier, origin?: TwoFactorPromptOrigin) => {
      if (!accountId) return
      dispatch({
        type: "dismissalRegistered",
        accountId,
        promptTier,
        origin,
        read: latestReadRef.current,
      })
    },
    [accountId],
  )

  /** A dismissal made while the fresh read was out is judged once the read has landed.
   *  The dismissal itself is among what makes the judging due, so none can wait on a
   *  change that is not coming. */
  const isDismissalDue =
    isSessionForAccount && isDismissalAwaitingRead && !isAwaitingFreshRead
  useEffect(() => {
    if (!isDismissalDue || !accountId) return
    dispatch({ type: "dismissalJudged", accountId, unmetTier })
  }, [isDismissalDue, accountId, unmetTier])

  /** The session start reads the highs once, when the fresh read of the account has
   *  landed. */
  const isHighReadDue =
    isSessionForAccount &&
    isLoadedForAccount &&
    isBalanceConfirmed &&
    !state.isAllTimeHighRead
  useEffect(() => {
    if (!isHighReadDue || !accountId) return
    dispatch({ type: "highsRead", accountId, tier, unmetTier, wallets })
  }, [isHighReadDue, accountId, tier, unmetTier, wallets])

  /** The reason is the one the bulletin was shown for: with no bulletin up there is
   *  nothing to wave away. */
  const dismissReminderBulletin = useCallback(() => {
    if (reminderBulletinReason === null) return
    registerDismissal(TwoFactorTier.Reminder, {
      prompt: TwoFactorPrompt.ReminderBulletin,
      reason: reminderBulletinReason,
    })
  }, [reminderBulletinReason, registerDismissal])

  const contextValue = useMemo(
    () => ({
      tier,
      unmetTier,
      isEnforced,
      hasAuthenticator,
      highBalanceCurrency: record.highBalanceCurrency,
      highBalanceThreshold: record.highBalanceThreshold,
      isHoldingHighBalance: isHoldingHighBalance(record, wallets),
      remainingDismissals: dismissalsLeft,
      isCustodyExitOffered,
      isCustodyExitOff,
      sessionPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      reminderBulletinReason,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
      dismissReminderBulletin,
      consumeSessionStart,
      registerDismissal,
    }),
    [
      tier,
      unmetTier,
      isEnforced,
      hasAuthenticator,
      record,
      wallets,
      dismissalsLeft,
      isCustodyExitOffered,
      isCustodyExitOff,
      sessionPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      reminderBulletinReason,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
      dismissReminderBulletin,
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
