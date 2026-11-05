import { TxDirection } from "@app/graphql/generated"

import { SplashCandidate, SplashSuppressReason } from "./types"

/** How far before the app came to the foreground a Lightning or intraledger receive may
 *  have settled and still count as live: covers clock skew with the server. */
export const FOREGROUND_GRACE_MS = 5000

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
  appActive: boolean
  alreadySeen: boolean
  enabled: boolean
  minSats: number
  /** Null when a USD receive cannot be priced. Fail closed: no splash. */
  amountSats: number | null
  routeName: string | undefined
  keyboardVisible: boolean
  appLocked: boolean
  overlayCovered: boolean
}

/** Custodial on-chain is exempt: its createdAt is when the transaction hit the
 *  mempool, long before the confirmation that brings it here. Self-custodial sets
 *  createdAtIsSettlement, including a claimed deposit, so a sync replay stays quiet. */
export const settledBeforeForeground = (
  candidate: SplashCandidate,
  foregroundSinceMs: number,
): boolean => {
  const checkFreshness =
    candidate.paymentType !== "onchain" || candidate.createdAtIsSettlement === true
  if (!checkFreshness) return false
  return candidate.transaction.createdAt * 1000 < foregroundSinceMs - FOREGROUND_GRACE_MS
}

export const decideSplash = ({
  candidate,
  foregroundSinceMs,
  appActive,
  alreadySeen,
  enabled,
  minSats,
  amountSats,
  routeName,
  keyboardVisible,
  appLocked,
  overlayCovered,
}: DecideInput): SplashDecision => {
  if (candidate.transaction.direction !== TxDirection.Receive) {
    return { outcome: "skip", reason: "outgoing" }
  }
  if (alreadySeen) return { outcome: "skip", reason: "already_seen" }
  if (!appActive) return { outcome: "skip", reason: "not_foreground" }
  if (settledBeforeForeground(candidate, foregroundSinceMs)) {
    return { outcome: "skip", reason: "settled_before_foreground" }
  }
  if (!enabled) return { outcome: "suppress", reason: SplashSuppressReason.OptedOut }
  if (amountSats === null || amountSats < minSats) {
    return { outcome: "suppress", reason: SplashSuppressReason.BelowMinimum }
  }
  if (
    !routeName ||
    !ALLOWED_ROUTES.has(routeName) ||
    keyboardVisible ||
    appLocked ||
    overlayCovered
  ) {
    return { outcome: "suppress", reason: SplashSuppressReason.BlockedRoute }
  }
  return { outcome: "show", amountSats }
}

/** Coarse sats bands. The exact amount never leaves the device. */
export const amountBucket = (amountSats: number): string => {
  if (amountSats < 100) return "lt_100"
  if (amountSats < 1_000) return "100_999"
  if (amountSats < 10_000) return "1k_10k"
  if (amountSats < 100_000) return "10k_100k"
  if (amountSats < 1_000_000) return "100k_1m"
  return "1m_plus"
}
