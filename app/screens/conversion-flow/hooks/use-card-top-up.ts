import { useRef, useState } from "react"

import {
  CardCollateralDepositMethod,
  HomeAuthedDocument,
  PaymentSendResult,
  useLnInvoicePaymentSendMutation,
} from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import {
  CardDepositIntent,
  CardDepositIntentError,
  useCardDepositIntentCreate,
} from "@app/hooks/use-card-deposit-intent"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { triggerHapticFeedback } from "@app/utils/helper"

type CardTopUpRequest = {
  /** The Bitcoin or Dollar wallet the funds leave. */
  walletId: string
  amountSats: number
}

export type CardTopUp = {
  execute: (request: CardTopUpRequest) => Promise<void>
  loading: boolean
  errorMessage?: string
}

/** A payment that went out, or one blink-card's invoice already holds: either way the
 *  funds are on their way to the Card Balance. */
const PAID_STATUSES: ReadonlySet<PaymentSendResult> = new Set([
  PaymentSendResult.Success,
  PaymentSendResult.Pending,
  PaymentSendResult.AlreadyPaid,
])

const messageOfRefusal = (
  { code, retryAfterSeconds }: CardDepositIntentError,
  LL: TranslationFunctions,
): string => {
  if (code === "RATE_LIMIT_EXCEEDED" && retryAfterSeconds !== undefined) {
    return LL.CardFlow.CardBalanceTransfer.waitAndRetry({ seconds: retryAfterSeconds })
  }
  if (code === "TOO_MANY_PENDING_DEPOSIT_INTENTS") {
    return LL.CardFlow.CardBalanceTransfer.tooManyPending()
  }
  return LL.common.error()
}

/**
 * Moves funds from a wallet into the Card Balance: blink-card names a Lightning invoice
 * for the amount, and the wallet pays it. The payment is never retried by itself. The
 * deposit is kept for the move, so a retry after a lost answer pays the same invoice,
 * which can only be paid once, instead of a second deposit.
 */
export const useCardTopUp = ({ onSuccess }: { onSuccess: () => void }): CardTopUp => {
  const { LL } = useI18nContext()
  const guard = useInFlightGuard()
  const { create, loading: isCreating } = useCardDepositIntentCreate()
  const [lnInvoicePaymentSend, { loading: isPaying }] = useLnInvoicePaymentSendMutation()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  /** The deposit asked for each amount during this move. */
  const depositsRef = useRef(new Map<number, CardDepositIntent>())

  const fail = (message: string) => {
    setErrorMessage(message)
    triggerHapticFeedback("notificationError")
  }

  const depositFor = async (amountSats: number) => {
    const kept = depositsRef.current.get(amountSats)
    if (kept) return { intent: kept }

    const created = await create(amountSats, CardCollateralDepositMethod.Lightning)
    if (created.intent) depositsRef.current.set(amountSats, created.intent)
    return created
  }

  const execute = async ({ walletId, amountSats }: CardTopUpRequest) => {
    await guard.run(async () => {
      setErrorMessage(undefined)

      const { intent, error } = await depositFor(amountSats)
      if (!intent) {
        if (error) recordAppError(new Error(`Card deposit refused: ${error.message}`))
        fail(error ? messageOfRefusal(error, LL) : LL.common.error())
        return
      }

      try {
        const { data, errors } = await lnInvoicePaymentSend({
          variables: { input: { walletId, paymentRequest: intent.destination } },
          refetchQueries: [HomeAuthedDocument],
        })
        const payload = data?.lnInvoicePaymentSend
        const status = payload?.status

        if (status && PAID_STATUSES.has(status)) {
          triggerHapticFeedback("notificationSuccess")
          onSuccess()
          return
        }

        const failure = errors?.length
          ? getErrorMessages(errors)
          : payload?.errors[0]?.message
        fail(failure ?? LL.common.error())
      } catch (err) {
        const paymentError = toError(err)
        recordAppError(paymentError)
        fail(paymentError.message)
      }
    })
  }

  return { execute, loading: isCreating || isPaying, errorMessage }
}
