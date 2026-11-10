import { WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorReminderReason,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

import {
  EnforcedCrossing,
  isSessionStartHighChange,
  withAllTimeHigh,
  withDismissal,
  withLastBalances,
  withSessionStartHigh,
  withTierReached,
} from "./two-factor-enforcement"

/**
 * Where a session's start stands. Preparing while the account's record is read: nothing
 * is decided. Owed once it is in: the start is still to be acted on, and whether it is
 * decided yet is the read's to say. Taken once a surface acted on it, or when there is
 * nothing to start, as with a record that could not be read.
 */
export const SessionStart = {
  Preparing: "preparing",
  Owed: "owed",
  Taken: "taken",
} as const
export type SessionStart = (typeof SessionStart)[keyof typeof SessionStart]

/** The prompt events the session reports. */
export type PromptEvent = {
  tier: TwoFactorTier
  prompt: TwoFactorPrompt
  reason?: TwoFactorReminderReason
}

/** What a transition leaves for the provider to carry out: a record to write, or an
 *  event to report. Kept in the state so a transition stays pure, and each is carried
 *  out once, in the order the transitions made them. */
export type SessionEffect =
  | { kind: "save"; accountId: string; record: TwoFactorEnforcementRecord }
  | { kind: "promptShown"; event: PromptEvent }
  | { kind: "promptDismissed"; event: PromptEvent }

/** The prompts reported as shown this session, by prompt and tier, for the account they
 *  were shown to. Apart from the session: the same account coming back through a gate
 *  that closed and opened again within the session keeps them. */
type Impressions = {
  accountId: string | null
  keys: ReadonlySet<string>
}

/**
 * The active account's record and what this session has done for it, kept in memory on
 * purpose: a session is a cold launch or a fresh login, and both give the provider a
 * fresh account to load, while a return from the background gives it nothing new.
 */
export type TwoFactorSessionState = {
  accountId: string | null
  /** The account's record, null while it is read or when it could not be. */
  record: TwoFactorEnforcementRecord | null
  start: SessionStart
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
  impressions: Impressions
  outbox: readonly SessionEffect[]
}

const NO_SESSION = {
  record: null,
  start: SessionStart.Preparing,
  countedTier: TwoFactorTier.None,
  dismissedTier: TwoFactorTier.None,
  isAllTimeHighRead: false,
  isNudgeCardHidden: false,
} as const

export const INITIAL_SESSION_STATE: TwoFactorSessionState = {
  ...NO_SESSION,
  accountId: null,
  impressions: { accountId: null, keys: new Set() },
  outbox: [],
}

/** What the account owes as last read: a dismissal is judged by it, not by what a
 *  handler bound to an earlier render saw. */
export type SessionRead = {
  isAwaitingFreshRead: boolean
  unmetTier: TwoFactorTier
  sessionPrompt: TwoFactorSessionPrompt
  isSessionStartDecided: boolean
  /** Whether leaving custody is known to be switched off: the high-balance modal's
   *  allowance leads to the blocking screen, which does not stand while it is. */
  isCustodyExitOff: boolean
}

export type SessionAction =
  | { type: "accountChanged"; accountId: string | null }
  | { type: "recordLoaded"; accountId: string; record: TwoFactorEnforcementRecord }
  | { type: "recordUnreadable"; accountId: string }
  | {
      type: "tierReached"
      accountId: string
      tier: TwoFactorTier
      crossing: EnforcedCrossing
      wallets: readonly WalletBalance[] | undefined
    }
  | {
      type: "highsRead"
      accountId: string
      tier: TwoFactorTier
      unmetTier: TwoFactorTier
      wallets: readonly WalletBalance[] | undefined
    }
  | { type: "dismissalJudged"; accountId: string; unmetTier: TwoFactorTier }
  | { type: "nudgeCardDismissed"; accountId: string; tier: TwoFactorTier }
  | { type: "sessionStartTaken" }
  | {
      type: "dismissalRegistered"
      accountId: string
      promptTier: TwoFactorTier
      origin?: TwoFactorPromptOrigin
      read: SessionRead
    }
  | {
      type: "promptShown"
      accountId: string
      prompt: TwoFactorPrompt
      tier: TwoFactorTier
      reason?: TwoFactorReminderReason
    }
  | { type: "impressionsReset" }
  | { type: "outboxDrained"; count: number }

const isSessionOf = (state: TwoFactorSessionState, accountId: string): boolean =>
  state.accountId === accountId && state.start !== SessionStart.Preparing

/** The account's record, when the state holds it for that account. */
const recordOf = (
  state: TwoFactorSessionState,
  accountId: string,
): TwoFactorEnforcementRecord | null =>
  state.accountId === accountId ? state.record : null

const withEffects = (
  state: TwoFactorSessionState,
  ...effects: SessionEffect[]
): TwoFactorSessionState => ({ ...state, outbox: [...state.outbox, ...effects] })

/** The record replaced and written. */
const withRecord = (
  state: TwoFactorSessionState,
  accountId: string,
  record: TwoFactorEnforcementRecord,
): TwoFactorSessionState =>
  withEffects({ ...state, record }, { kind: "save", accountId, record })

/** Another account, or none, starts a session of its own; the impressions stay. */
const changeAccount = (
  state: TwoFactorSessionState,
  accountId: string | null,
): TwoFactorSessionState => {
  if (state.accountId === accountId) return state
  return { ...state, ...NO_SESSION, accountId }
}

/** The balance that raises the tier is also the first all-time high the recommended tier
 *  measures against, mid-session or not: a later session start below it is no new high,
 *  however far the balance fell in between. It is kept as the last balances too, so a
 *  transfer made after the raise is told by what the account held then. */
const reachTier = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "tierReached" }>,
): TwoFactorSessionState => {
  const record = recordOf(state, action.accountId)
  if (record === null) return state
  const isHigherTier = action.tier > record.highestTier
  if (!isHigherTier) return state
  const raised = withTierReached(record, action.tier, action.crossing)
  const seeded = withLastBalances(withAllTimeHigh(raised, action.wallets), action.wallets)
  return withRecord(state, action.accountId, seeded)
}

/**
 * At the suggested and recommended tiers, the session start reads each wallet against its
 * all-time high once, when the fresh read of the account has landed, and raises the
 * highs it finds exceeded, so the next session start measures against the new ones. By
 * the tier reached, not the one owed: an account that holds an authenticator for a
 * while and then removes it is measured against what its sessions saw meanwhile. What
 * the balance does later in the session waits for the next session start. Below the
 * suggested tier the raise into it seeds the highs, and above the recommended tier the
 * bulletin never comes back. A new high found while the recommended tier is owed stays
 * pending in the record, bringing the bulletin back at every session start, until a
 * dismissal of the tier closes it. Measured against the record as last written: a tier
 * raised in the same pass has already seeded the highs with this balance, which is then
 * no new high.
 */
const readHighs = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "highsRead" }>,
): TwoFactorSessionState => {
  const record = recordOf(state, action.accountId)
  const isDue = isSessionOf(state, action.accountId) && !state.isAllTimeHighRead
  const isSkipped = record === null || !isDue
  if (isSkipped) return state
  const read = { ...state, isAllTimeHighRead: true }
  const isTrackingHighs =
    action.tier === TwoFactorTier.Suggested || action.tier === TwoFactorTier.Recommended
  const isChanged =
    isTrackingHighs && isSessionStartHighChange(record, action.wallets, action.unmetTier)
  if (!isChanged) return read
  const next = withSessionStartHigh(record, action.wallets, action.unmetTier)
  return withRecord(read, action.accountId, next)
}

/** Judges a dismissal made while the fresh read was out, once it has landed: the start
 *  is taken if the prompt waved away still covers what the account owes, and kept for
 *  the escalated prompt otherwise. A read that failed lands as what the account last
 *  read as, which the dismissal covered. Not judged by the session prompt: the last of
 *  the modal's dismissals is what turns it into the blocking screen's, which is due at
 *  the next session start, not this one. */
const judgeDismissal = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "dismissalJudged" }>,
): TwoFactorSessionState => {
  const hasKeptDismissal = state.dismissedTier !== TwoFactorTier.None
  const isDue = isSessionOf(state, action.accountId) && hasKeptDismissal
  if (!isDue) return state
  const isCovered = state.dismissedTier >= action.unmetTier
  const isTaken = state.start === SessionStart.Owed && isCovered
  return {
    ...state,
    start: isTaken ? SessionStart.Taken : state.start,
    dismissedTier: TwoFactorTier.None,
  }
}

/** Closed for good at a tier this account's record holds. A card raised from a balance
 *  the network never confirmed closes for the session only, as any prompt does. A
 *  second press that lands before the card goes closes nothing more and reports
 *  nothing. */
const dismissNudgeCard = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "nudgeCardDismissed" }>,
): TwoFactorSessionState => {
  const record = recordOf(state, action.accountId)
  const isAlreadyClosed = Boolean(record?.nudgeCardDismissed) || state.isNudgeCardHidden
  if (isAlreadyClosed) return state
  const reported: SessionEffect = {
    kind: "promptDismissed",
    event: { tier: action.tier, prompt: TwoFactorPrompt.HomeCard },
  }
  const isTierStored = record !== null && record.highestTier >= TwoFactorTier.Suggested
  if (isTierStored) {
    const closed = withRecord(state, action.accountId, {
      ...record,
      nudgeCardDismissed: true,
    })
    return withEffects(closed, reported)
  }
  if (!isSessionOf(state, action.accountId)) return state
  return withEffects({ ...state, isNudgeCardHidden: true }, reported)
}

/**
 * A dismissal takes the session start when the prompt waved away is the one the start
 * owes, counted or not: on the home or on a flow the prompt opened, the home must not
 * raise it again on the way back. A start that a fresher read has since made owe a
 * higher tier's prompt is kept for that prompt. While the fresh read is still out, a
 * prompt raised from the local read can be waved away before the read says whether the
 * account owes more: the dismissal is kept until it lands, and judged then, so a
 * balance that crossed into a higher tier elsewhere still gets that tier's prompt this
 * session. What is kept is the highest tier waved away, so a lower one reported after
 * it, or the no prompt the modal's closing frames report, cannot replace it and raise
 * the prompt again. Only a start already decided keeps one: a prompt the start has not
 * decided on was never up to be waved away. A counted dismissal is reported, once, as
 * the dismissal of the prompt it answers: a second press that lands before the prompt
 * goes counts nothing and reports nothing.
 *
 * The blocking screen has no X: a start that owes it is no dismissal's to take, and
 * leaving a flow opened over it counts nothing, the tier's dismissals being spent. The
 * Settings banner owes nothing either: it is no prompt of the session start, so a setup
 * opened from it and closed spends no dismissal and takes no start.
 */
const registerDismissal = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "dismissalRegistered" }>,
): TwoFactorSessionState => {
  const { accountId, promptTier, origin, read } = action
  const hasPromptTier = promptTier !== TwoFactorTier.None
  const isPromptCounted = origin?.prompt !== TwoFactorPrompt.SettingsBanner
  const isBlockingStart = read.sessionPrompt === TwoFactorSessionPrompt.ProtectionRequired
  const isConsidered =
    hasPromptTier && isPromptCounted && isSessionOf(state, accountId) && !isBlockingStart
  if (!isConsidered) return state

  /** Waved away for the session at any tier that counts one, so the prompt goes until
   *  the next session start. Spent from the record only at a tier the record holds: a
   *  prompt raised from a balance the network never confirmed must not spend the
   *  dismissals of a tier the account may not have reached. The high-balance modal
   *  spends nothing while leaving custody is known to be off either: it stays
   *  dismissible then, with no countdown, and its allowance is where it was once the
   *  blocking screen can stand again. While that is not known yet, it spends as ever. */
  const record = recordOf(state, accountId)
  const isTierStored = record !== null && record.highestTier >= promptTier
  const isEnforcedPrompt = promptTier === TwoFactorTier.Enforced
  const isAllowanceLive = !isEnforcedPrompt || !read.isCustodyExitOff
  const isCountingTier = promptTier >= TwoFactorTier.Recommended
  const isAboveCounted = promptTier > state.countedTier
  const isCountable = isCountingTier && isAboveCounted
  const isStartPending = state.start === SessionStart.Owed
  const isPromptOwed = promptTier >= read.unmetTier
  const isStartOwedToPrompt = read.isSessionStartDecided && isPromptOwed
  const isStartAwaitingRead = isStartPending && read.isAwaitingFreshRead
  const isStartTaken = isStartPending && isStartOwedToPrompt && !isStartAwaitingRead
  const isAboveKept = promptTier > state.dismissedTier
  const isKeptForRead = isStartAwaitingRead && read.isSessionStartDecided && isAboveKept
  const isAnswering = isCountable || isStartTaken || isKeptForRead
  if (!isAnswering) return state

  const answered: TwoFactorSessionState = {
    ...state,
    start: isStartTaken ? SessionStart.Taken : state.start,
    countedTier: isCountable ? promptTier : state.countedTier,
    dismissedTier: isKeptForRead ? promptTier : state.dismissedTier,
  }
  const isSpent = isCountable && isTierStored && isAllowanceLive
  const isRecordSpent = isSpent && record !== null
  const spentRecord = isRecordSpent ? withDismissal(record, promptTier) : record
  const isRecordChanged = spentRecord !== null && spentRecord !== record
  const spent = isRecordChanged ? withRecord(answered, accountId, spentRecord) : answered
  if (!isCountable || origin === undefined) return spent
  return withEffects(spent, {
    kind: "promptDismissed",
    event: { tier: promptTier, prompt: origin.prompt, reason: origin.reason },
  })
}

/** Reports a prompt as shown, once per session for each tier it is shown at: a surface
 *  mounts again on every visit, and that is no new impression. Another account's
 *  impressions start afresh. */
const markPromptShown = (
  state: TwoFactorSessionState,
  action: Extract<SessionAction, { type: "promptShown" }>,
): TwoFactorSessionState => {
  const isSameAccount = state.impressions.accountId === action.accountId
  const keys = isSameAccount ? state.impressions.keys : new Set<string>()
  const key = `${action.prompt}:${action.tier}`
  if (keys.has(key)) return state
  const impressions = { accountId: action.accountId, keys: new Set(keys).add(key) }
  return withEffects(
    { ...state, impressions },
    {
      kind: "promptShown",
      event: { tier: action.tier, prompt: action.prompt, reason: action.reason },
    },
  )
}

export const twoFactorSessionReducer = (
  state: TwoFactorSessionState,
  action: SessionAction,
): TwoFactorSessionState => {
  switch (action.type) {
    case "accountChanged":
      return changeAccount(state, action.accountId)
    case "recordLoaded":
      if (state.accountId !== action.accountId) return state
      return { ...state, ...NO_SESSION, record: action.record, start: SessionStart.Owed }
    case "recordUnreadable":
      /** A record that could not be read is not a missing one: with the account left
       *  unloaded, nothing is prompted and nothing is written, so a transient read
       *  failure cannot replace a dismissal or a reached tier with the defaults. The
       *  session is still the account's, with nothing to start, so no surface waits on
       *  a start that will never be decided. */
      if (state.accountId !== action.accountId) return state
      return { ...state, ...NO_SESSION, start: SessionStart.Taken }
    case "tierReached":
      return reachTier(state, action)
    case "highsRead":
      return readHighs(state, action)
    case "dismissalJudged":
      return judgeDismissal(state, action)
    case "nudgeCardDismissed":
      return dismissNudgeCard(state, action)
    case "sessionStartTaken":
      if (state.start !== SessionStart.Owed) return state
      return { ...state, start: SessionStart.Taken }
    case "dismissalRegistered":
      return registerDismissal(state, action)
    case "promptShown":
      return markPromptShown(state, action)
    case "impressionsReset":
      return { ...state, impressions: INITIAL_SESSION_STATE.impressions }
    case "outboxDrained":
      return { ...state, outbox: state.outbox.slice(action.count) }
  }
}
