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
  TwoFactorEnforcementRecord,
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
  isAboveAllTimeHigh,
  normalizeStoredRecord,
  remainingDismissals,
  quotedEnforcedThreshold,
  resolveBalanceTier,
  resolveEnforcedCrossing,
  resolveReminderReason,
  resolveSessionPrompt,
  resolveUnmetTier,
  withAllTimeHigh,
  withDismissal,
  withSessionStartHigh,
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
  /** Whether this session's start has read the wallets against their all-time highs,
   *  which it does once, when the fresh read lands. */
  isAllTimeHighRead: boolean
  /** The nudge card closed for this session only, at a tier the record does not hold. */
  isNudgeCardHidden: boolean
}

const INITIAL_SESSION: SessionState = {
  accountId: null,
  isStartPending: false,
  countedTier: TwoFactorTier.None,
  dismissedTier: TwoFactorTier.None,
  isAllTimeHighRead: false,
  isNudgeCardHidden: false,
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
  /** The wallet the high-balance copy names, meaningful at the enforced tier. */
  enforcedCurrency: WalletCurrency
  /** The threshold that copy quotes, in that wallet's unit. */
  enforcedThreshold: number
  remainingDismissals: number
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
  /** The recommended tier's bulletin on the home, in the card's place: due at every
   *  session start while the tier's dismissals last, then at each new all-time high,
   *  and gone for the session once waved away. It never blocks. */
  shouldShowReminderBulletin: boolean
  /** Why the reminder bulletin is due, null when it is not: what its events report. */
  reminderReason: TwoFactorReminderReason | null
  shouldShowSettingsBanner: boolean
  /** Reports a prompt as shown, once per session for each tier it is shown at: a
   *  surface mounts again on every visit, and that is no new impression. */
  markPromptShown: (prompt: TwoFactorPrompt, reason?: TwoFactorReminderReason) => void
  dismissNudgeCard: () => void
  /** The bulletin's X: one dismissal of the recommended tier, at most one per session. */
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
  hasAuthenticator: false,
  enforcedCurrency: WalletCurrency.Btc,
  enforcedThreshold: 0,
  remainingDismissals: 0,
  sessionPrompt: TwoFactorSessionPrompt.None,
  isSessionStartPending: false,
  isPreparingSessionStart: false,
  isProtectionGateActive: false,
  shouldShowNudgeCard: false,
  shouldShowReminderBulletin: false,
  reminderReason: null,
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
 * never shows one account's prompts from the other's record.
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
  const { remoteConfigReady: isConfigFresh } = useFeatureFlags()
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
  /** The wind-down's push into the migration, which the blocking screen yields to,
   *  from the same read the home shows the push from. */
  const migrateNowRemedy = useMigrateNowRemedy()

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
  /** The fresh read is the account from the network and the thresholds from this
   *  launch's console fetch. Until the fetch settles, the thresholds are what an earlier
   *  launch activated, and a tier raised from them would stay raised once the console's
   *  new ones land, since a reached tier never lowers. The fetch settles whether or not
   *  it succeeds. */
  const isAwaitingFreshRead = isReadingAccount || !isConfigFresh
  /** A read that fails lands as what the account last read as: the session can decide
   *  from it, but nothing is written from it, since a tier reached never lowers and a
   *  high only rises. What the network has confirmed is what the record keeps. */
  const isReadConfirmed = freshRead === FreshAccountRead.Confirmed
  const isBalanceConfirmed = isConfigFresh && isReadConfirmed

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
        commitSession({ ...INITIAL_SESSION, accountId, isStartPending: true })
      })
      .catch((err) => {
        if (!isMounted) return
        reportError("Two-factor enforcement read", err)
        /** Nothing to start, stated as such even though an unloaded record already
         *  keeps the start from being pending: the session says what it means. */
        commitSession({ ...INITIAL_SESSION, accountId, isStartPending: false })
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
  /** No tier is read from a balance or thresholds that may be stale: the persisted cache
   *  answers before the network, and can hold a balance the account no longer has. A
   *  tier raised from it, and the high seeded with it, would stay. Until the fresh read
   *  lands, the stored tier alone stands; a read that fails lands as what the account
   *  last read as, which is then all there is to decide from. */
  const balanceTier = isAwaitingFreshRead
    ? TwoFactorTier.None
    : resolveBalanceTier(wallets, thresholds)
  const tier = balanceTier > record.highestTier ? balanceTier : record.highestTier

  /** The balance that raises the tier is also the first all-time high the recommended
   *  tier measures against, mid-session or not: a later session start below it is no
   *  new high, however far the balance fell in between. */
  useEffect(() => {
    const isRaised = balanceTier > record.highestTier
    const isRaiseDue = isLoadedForAccount && isBalanceConfirmed && isRaised
    if (!isRaiseDue) return
    const crossing = resolveEnforcedCrossing(wallets, thresholds)
    persist((current) =>
      withAllTimeHigh(withTierReached(current, balanceTier, crossing), wallets),
    )
  }, [
    isLoadedForAccount,
    isBalanceConfirmed,
    balanceTier,
    record.highestTier,
    wallets,
    thresholds,
    persist,
  ])

  const hasAuthenticator = Boolean(me?.totpEnabled)

  const isEnforced = isEnabled && isLoadedForAccount
  const unmetTier = isEnforced
    ? resolveUnmetTier({ tier, hasAuthenticator })
    : TwoFactorTier.None
  const dismissalsLeft = remainingDismissals(record, unmetTier)
  const enforcedThreshold = quotedEnforcedThreshold(record, thresholds)
  const sessionPrompt = resolveSessionPrompt({ unmetTier, record })
  /** The local read decides first: the stored tier never lowers and the cached
   *  authenticator is what the account last showed, so a prompt they already call for
   *  goes up on the first frame. Only a local read that owes nothing waits for the fresh
   *  one, which can still raise the tier from a balance that moved elsewhere. */
  const hasLocalPrompt = sessionPrompt !== TwoFactorSessionPrompt.None
  const isSessionStartDecided = hasLocalPrompt || !isAwaitingFreshRead
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

  /** The card belongs to the suggested tier alone: from the recommended tier on, that
   *  tier's own prompt asks instead, and the home never stacks two. The banner asks at
   *  every tier until the account holds an authenticator. */
  const isNudgeCardClosed = record.nudgeCardDismissed || session.isNudgeCardHidden
  const shouldShowNudgeCard = unmetTier === TwoFactorTier.Suggested && !isNudgeCardClosed
  const shouldShowSettingsBanner = unmetTier !== TwoFactorTier.None

  /** The reminder bulletin takes the card's place at the recommended tier, whether or not
   *  the card was closed, once the fresh read confirms the account still owes it: an
   *  authenticator added elsewhere is not in the cached copy. A dismissal of the tier
   *  this session, from the bulletin or from a setup left unfinished, puts it away until
   *  the next session start. */
  const reminderReason = resolveReminderReason({ unmetTier, record })
  const isReminderWavedAway = session.countedTier >= TwoFactorTier.Recommended
  const isReminderDue =
    reminderReason !== null && isSessionForAccount && !isAwaitingFreshRead
  const shouldShowReminderBulletin = isReminderDue && !isReminderWavedAway

  /** A logout ends the session, so a fresh login starts its impressions afresh, for
   *  the same account too: its prompts are due again and are new impressions. */
  useEffect(() => {
    if (!isAuthed) shownPromptsRef.current = { accountId: null, impressions: new Set() }
  }, [isAuthed])

  /** Another account's impressions start afresh; the same account coming back through
   *  a gate that closed and opened again within the session keeps its own. With the
   *  gate closed there is no account to have shown a prompt to. */
  const markPromptShown = useCallback(
    (prompt: TwoFactorPrompt, reason?: TwoFactorReminderReason) => {
      if (!accountId) return
      const isAnotherAccount = shownPromptsRef.current.accountId !== accountId
      if (isAnotherAccount) {
        shownPromptsRef.current = { accountId, impressions: new Set() }
      }
      const { impressions } = shownPromptsRef.current
      const impression = `${prompt}:${tier}`
      if (impressions.has(impression)) return
      impressions.add(impression)
      logTwoFactorPromptShown({ tier, prompt, reason })
    },
    [accountId, tier],
  )

  /** Closed for good at a tier this account's record holds. A card raised from a
   *  balance the network never confirmed closes for the session only, as any prompt
   *  does. A second press that lands before the card goes closes nothing more and
   *  reports nothing. */
  const dismissNudgeCard = useCallback(() => {
    const stored = latestStoredRef.current
    const latest = latestSessionRef.current
    const isAlreadyClosed = stored.record.nudgeCardDismissed || latest.isNudgeCardHidden
    if (isAlreadyClosed) return
    const isTierStored = stored.record.highestTier >= TwoFactorTier.Suggested
    const isClosedForGood =
      isTierStored && persist((current) => ({ ...current, nudgeCardDismissed: true }))
    const isSessionAccount = accountId !== null && latest.accountId === accountId
    const isClosable = isClosedForGood || isSessionAccount
    if (!isClosable) return
    if (!isClosedForGood) commitSession({ ...latest, isNudgeCardHidden: true })
    logTwoFactorPromptDismissed({ tier, prompt: TwoFactorPrompt.HomeCard })
  }, [accountId, tier, persist, commitSession])

  const consumeSessionStart = useCallback(() => {
    commitSession({ ...latestSessionRef.current, isStartPending: false })
  }, [commitSession])

  /** The read as last committed, for a dismissal reported by a handler bound to an
   *  earlier render, as the hardware back's can be in the frames between a commit and
   *  its effects: the dismissal is judged by what the account owes now, not by what it
   *  owed when the handler was bound, so no commit shows the home in between. */
  const latestReadRef = useRef({
    isAwaitingFreshRead,
    unmetTier,
    sessionPrompt,
    isSessionStartDecided,
  })
  useLayoutEffect(() => {
    latestReadRef.current = {
      isAwaitingFreshRead,
      unmetTier,
      sessionPrompt,
      isSessionStartDecided,
    }
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
   *  closing frames report, cannot replace it and raise the prompt again. A counted
   *  dismissal is reported, once, as the dismissal of the prompt it answers: a second
   *  press that lands before the prompt goes counts nothing and reports nothing. */
  const registerDismissal = useCallback(
    (promptTier: TwoFactorTier, origin?: TwoFactorPromptOrigin) => {
      if (promptTier === TwoFactorTier.None) return
      const latest = latestSessionRef.current
      const read = latestReadRef.current
      const isSessionAccount = accountId !== null && latest.accountId === accountId
      /** The blocking screen has no X: a start that owes it is no dismissal's to take,
       *  and leaving a flow opened over it counts nothing, the tier's dismissals being
       *  spent. The screen goes up once the user is back on the home. */
      const isBlockingStart =
        read.sessionPrompt === TwoFactorSessionPrompt.ProtectionRequired
      if (!isSessionAccount || isBlockingStart) return
      /** Waved away for the session at any tier that counts one, so the prompt goes until
       *  the next session start. Spent from the record only at a tier the record holds:
       *  a prompt raised from a balance the network never confirmed must not spend the
       *  dismissals of a tier the account may not have reached. */
      const stored = latestStoredRef.current
      const isStoredForAccount = stored.accountId === accountId
      const isTierStored = isStoredForAccount && stored.record.highestTier >= promptTier
      const isCountable =
        promptTier >= TwoFactorTier.Recommended && promptTier > latest.countedTier
      const isSpent = isCountable && isTierStored
      const isStartOwedToPrompt =
        read.isSessionStartDecided && promptTier >= read.unmetTier
      const isStartAwaitingRead = latest.isStartPending && read.isAwaitingFreshRead
      const isStartTaken =
        latest.isStartPending && isStartOwedToPrompt && !isStartAwaitingRead
      const isHigherThanKept = promptTier > latest.dismissedTier
      const isKeptForRead = isStartAwaitingRead && isHigherThanKept
      if (!isCountable && !isStartTaken && !isKeptForRead) return
      if (isSpent) persist((current) => withDismissal(current, promptTier))
      commitSession({
        ...latest,
        isStartPending: latest.isStartPending && !isStartTaken,
        countedTier: isCountable ? promptTier : latest.countedTier,
        dismissedTier: isKeptForRead ? promptTier : latest.dismissedTier,
      })
      const isReported = isCountable && origin !== undefined
      if (isReported) {
        logTwoFactorPromptDismissed({
          tier: promptTier,
          prompt: origin.prompt,
          reason: origin.reason,
        })
      }
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
      latest.dismissedTier !== TwoFactorTier.None && !isAwaitingFreshRead
    if (!isSessionAccount || !isDismissalDue) return
    /** Not judged by the session prompt: the last of the modal's dismissals is what turns
     *  it into the blocking screen's, which is due at the next session start, not this
     *  one. A start that already owed the blocking screen kept no dismissal. */
    const isCovered = latest.dismissedTier >= unmetTier
    commitSession({
      ...latest,
      isStartPending: latest.isStartPending && !isCovered,
      dismissedTier: TwoFactorTier.None,
    })
  }, [accountId, isAwaitingFreshRead, unmetTier, session.dismissedTier, commitSession])

  /** At the suggested and recommended tiers, the session start reads each wallet against
   *  its all-time high once, when the fresh read of the account has landed, and raises
   *  the highs it finds exceeded, so the next session start measures against the new
   *  ones. By the tier reached, not the one owed: an account that holds an authenticator
   *  for a while and then removes it is measured against what its sessions saw meanwhile.
   *  What the balance does later in the session waits for the next session start. Below
   *  the suggested tier the raise into it seeds the highs, and above the recommended tier
   *  the bulletin never comes back. A new high found while the recommended tier is owed
   *  stays pending in the record, bringing the bulletin back at every session start,
   *  until a dismissal of the tier closes it. */
  useEffect(() => {
    const latest = latestSessionRef.current
    const isSessionAccount = accountId !== null && latest.accountId === accountId
    const isAccountRead = isLoadedForAccount && isBalanceConfirmed
    const isHighDue = isSessionAccount && !latest.isAllTimeHighRead && isAccountRead
    if (!isHighDue) return
    const isTrackingHighs =
      tier === TwoFactorTier.Suggested || tier === TwoFactorTier.Recommended
    /** Against the record as last written: a tier raised in the same pass has already
     *  seeded the highs with this balance, which is then no new high. */
    const latestRecord = latestStoredRef.current.record
    const hasRisen = isAboveAllTimeHigh(latestRecord, wallets)
    const isPendingSettled =
      latestRecord.isNewHighPending && unmetTier !== TwoFactorTier.Recommended
    const isRecordChanged = isTrackingHighs && (hasRisen || isPendingSettled)
    if (isRecordChanged) {
      persist((current) => withSessionStartHigh(current, wallets, unmetTier))
    }
    commitSession({ ...latest, isAllTimeHighRead: true })
  }, [
    accountId,
    isLoadedForAccount,
    isBalanceConfirmed,
    tier,
    unmetTier,
    record,
    wallets,
    session.accountId,
    persist,
    commitSession,
  ])

  /** The reason is the one the bulletin was shown for, which a bulletin on screen always
   *  has. */
  const dismissReminderBulletin = useCallback(() => {
    if (reminderReason === null) return
    registerDismissal(TwoFactorTier.Recommended, {
      prompt: TwoFactorPrompt.ReminderBulletin,
      reason: reminderReason,
    })
  }, [reminderReason, registerDismissal])

  const contextValue = useMemo(
    () => ({
      tier,
      unmetTier,
      hasAuthenticator,
      enforcedCurrency: record.enforcedCurrency,
      enforcedThreshold,
      remainingDismissals: dismissalsLeft,
      sessionPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      shouldShowReminderBulletin,
      reminderReason,
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
      hasAuthenticator,
      record.enforcedCurrency,
      enforcedThreshold,
      dismissalsLeft,
      sessionPrompt,
      isSessionStartPending,
      isPreparingSessionStart,
      isProtectionGateActive,
      shouldShowNudgeCard,
      shouldShowReminderBulletin,
      reminderReason,
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
