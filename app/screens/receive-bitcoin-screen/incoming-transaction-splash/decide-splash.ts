import { TxDirection } from "@app/graphql/generated"

import { SplashCandidate, SplashSuppressReason } from "./types"

/** How far before the app came to the foreground a Lightning or intraledger receive may
 *  have settled and still count as live: covers clock skew with the server. */
export const FOREGROUND_GRACE_MS = 5000

/** The oldest a payment whose claim was seen live may be and still count as new: the
 *  longest invoice the app asks for lasts a day. Keeps an old payment that sat pending
 *  through a restore, then settled, from firing. */
export const LIVE_CLAIM_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** The only screens a splash may cover. Everything else, including any screen
 *  added later, drops it. */
export const ALLOWED_ROUTES: ReadonlySet<string> = new Set([
  "Home",
  "transactionHistory",
  "settings",
  "receiveBitcoin",
])

export type SplashSkipReason =
  | "outgoing"
  | "already_seen"
  | "not_foreground"
  | "settled_before_foreground"

export type SplashDecision =
  | { outcome: "show"; amountSats: number }
  | { outcome: "suppress"; reason: SplashSuppressReason }
  | { outcome: "skip"; reason: SplashSkipReason }

type DecideInput = {
  candidate: SplashCandidate
  foregroundSinceMs: number
  nowMs: number
  appActive: boolean
  alreadySeen: boolean
  enabled: boolean
  minSats: number
  /** Null when a USD receive cannot be priced. Fail closed: no splash. */
  amountSats: number | null
  routeName: string | undefined
  keyboardVisible: boolean
  appLocked: boolean
}

/** Custodial on-chain is exempt: its createdAt is the server's mempool time, not the
 *  device's, and its one pending update is only ever sent live. Self-custodial sets
 *  createdAtIsSettlement, a detected deposit included, so a sync replay stays quiet.
 *  A self-custodial payment whose claim was seen live is exempt too: its createdAt is
 *  when its invoice was made, so leaving the app to pay it from another wallet would
 *  otherwise drop it. */
export const settledBeforeForeground = (
  candidate: SplashCandidate,
  foregroundSinceMs: number,
  nowMs: number,
): boolean => {
  const checkFreshness =
    candidate.paymentType !== "onchain" || candidate.createdAtIsSettlement === true
  if (!checkFreshness) return false
  const createdAtMs = candidate.transaction.createdAt * 1000
  if (candidate.claimSeenLive && createdAtMs >= nowMs - LIVE_CLAIM_MAX_AGE_MS) {
    return false
  }
  return createdAtMs < foregroundSinceMs - FOREGROUND_GRACE_MS
}

export const decideSplash = ({
  candidate,
  foregroundSinceMs,
  nowMs,
  appActive,
  alreadySeen,
  enabled,
  minSats,
  amountSats,
  routeName,
  keyboardVisible,
  appLocked,
}: DecideInput): SplashDecision => {
  if (candidate.transaction.direction !== TxDirection.Receive) {
    return { outcome: "skip", reason: "outgoing" }
  }
  if (alreadySeen) return { outcome: "skip", reason: "already_seen" }
  if (!appActive) return { outcome: "skip", reason: "not_foreground" }
  if (settledBeforeForeground(candidate, foregroundSinceMs, nowMs)) {
    return { outcome: "skip", reason: "settled_before_foreground" }
  }
  if (!enabled) return { outcome: "suppress", reason: SplashSuppressReason.OptedOut }
  if (amountSats === null || amountSats < minSats) {
    return { outcome: "suppress", reason: SplashSuppressReason.BelowMinimum }
  }
  if (!routeName || !ALLOWED_ROUTES.has(routeName) || keyboardVisible || appLocked) {
    return { outcome: "suppress", reason: SplashSuppressReason.BlockedRoute }
  }
  return { outcome: "show", amountSats }
}
