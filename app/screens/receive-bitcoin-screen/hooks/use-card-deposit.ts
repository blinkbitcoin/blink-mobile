import { useCallback, useEffect, useMemo, useState } from "react"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
} from "@app/graphql/generated"
import { useCountdown } from "@app/hooks/use-countdown"
import {
  CardDepositIntent,
  CardDepositIntentError,
  useCardDepositIntentCreate,
  useCardDepositIntentStatus,
} from "@app/hooks/use-card-deposit-intent"

import { PaymentRequestState, PaymentRequestStateType } from "../payment/index.types"

const RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
/** blink-card's default wait between two deposits of one account. */
const FALLBACK_RETRY_SECONDS = 30
const MS_PER_SECOND = 1000

type SettledStatus = Exclude<
  CardCollateralDepositIntentStatus,
  typeof CardCollateralDepositIntentStatus.Pending
>

const STATE_BY_STATUS: Record<SettledStatus, PaymentRequestStateType> = {
  [CardCollateralDepositIntentStatus.Processing]: PaymentRequestState.Converting,
  [CardCollateralDepositIntentStatus.Consumed]: PaymentRequestState.Paid,
  [CardCollateralDepositIntentStatus.Expired]: PaymentRequestState.Expired,
  [CardCollateralDepositIntentStatus.Failed]: PaymentRequestState.Error,
}

type DepositStateFacts = {
  shouldCreate: boolean
  error: CardDepositIntentError | undefined
  intent: CardDepositIntent | undefined
  status: CardCollateralDepositIntentStatus | undefined
  isExpired: boolean
}

const depositState = ({
  shouldCreate,
  error,
  intent,
  status,
  isExpired,
}: DepositStateFacts): PaymentRequestStateType => {
  if (!shouldCreate) return PaymentRequestState.Idle
  if (error) return PaymentRequestState.Error
  if (!intent) return PaymentRequestState.Loading
  if (status && status !== CardCollateralDepositIntentStatus.Pending) {
    return STATE_BY_STATUS[status]
  }
  if (isExpired) return PaymentRequestState.Expired
  return PaymentRequestState.Created
}

type UseCardDepositParams = {
  method: CardCollateralDepositMethod
  amountSats: number
  isRequested: boolean
}

/**
 * One deposit into the Card Balance, minted by blink-card for an amount: a
 * Lightning invoice or an on-chain address. blink-card lets an account mint
 * one deposit every few seconds, so a refused mint waits the time it names and
 * tries again instead of failing.
 */
export const useCardDeposit = ({
  method,
  amountSats,
  isRequested,
}: UseCardDepositParams) => {
  const { create } = useCardDepositIntentCreate()
  const [intent, setIntent] = useState<CardDepositIntent>()
  const [error, setError] = useState<CardDepositIntentError>()
  const [attempt, setAttempt] = useState(0)

  const hasAmount = amountSats > 0
  const shouldCreate = isRequested && hasAmount

  useEffect(() => {
    setIntent(undefined)
    setError(undefined)
    if (!shouldCreate) return undefined

    let isCancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const mint = async () => {
      const result = await create(amountSats, method)
      if (isCancelled) return
      if (result.intent) {
        setIntent(result.intent)
        return
      }
      if (result.error.code === RATE_LIMIT_EXCEEDED) {
        const waitSeconds = result.error.retryAfterSeconds ?? FALLBACK_RETRY_SECONDS
        retryTimer = setTimeout(mint, waitSeconds * MS_PER_SECOND)
        return
      }
      setError(result.error)
    }
    mint()

    return () => {
      isCancelled = true
      clearTimeout(retryTimer)
    }
  }, [shouldCreate, amountSats, method, attempt, create])

  const { status, creditedSats } = useCardDepositIntentStatus(intent?.intentId)

  /** blink-card credits an on-chain payment that confirms after its address
   *  expired, so only a Lightning invoice runs out. */
  const isLightning = method === CardCollateralDepositMethod.Lightning
  const expiresAt = useMemo(
    () => (intent && isLightning ? new Date(intent.expiresAt) : null),
    [intent, isLightning],
  )
  const { remainingSeconds, isExpired } = useCountdown(expiresAt)

  const regenerate = useCallback(() => setAttempt((count) => count + 1), [])

  return {
    destination: intent?.destination,
    state: depositState({ shouldCreate, error, intent, status, isExpired }),
    status,
    error,
    creditedSats,
    expiresInSeconds: remainingSeconds,
    regenerate,
  }
}
