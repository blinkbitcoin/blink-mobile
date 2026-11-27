import { useRef, useState } from "react"
import Crypto from "react-native-quick-crypto"
import { ApolloError, gql } from "@apollo/client"

import {
  CardCollateralWithdrawalStatus,
  HomeAuthedDocument,
  useCardCollateralWithdrawMutation,
} from "@app/graphql/generated"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { triggerHapticFeedback } from "@app/utils/helper"

gql`
  mutation cardCollateralWithdraw($input: CardCollateralWithdrawInput!) {
    cardCollateralWithdraw(input: $input) {
      id
      amountSats
      status
      requestedAt
    }
  }
`

export type CardWithdrawal = {
  execute: (request: { amountSats: number }) => Promise<void>
  loading: boolean
  errorMessage?: string
}

const INSUFFICIENT_CARD_BALANCE = "INSUFFICIENT_CARD_BALANCE"

/** On its way or already in the wallet: either way the move is done for the member. */
const MOVED_STATUSES: ReadonlySet<CardCollateralWithdrawalStatus> = new Set([
  CardCollateralWithdrawalStatus.Completed,
  CardCollateralWithdrawalStatus.Processing,
])

const isInsufficientBalance = (err: unknown): boolean =>
  err instanceof ApolloError &&
  err.graphQLErrors.some(
    ({ extensions }) => extensions?.code === INSUFFICIENT_CARD_BALANCE,
  )

/**
 * Moves sats from the Card Balance back to the member's Bitcoin wallet, sat for sat. One
 * key per move, sent again on every retry, so a retry after a lost answer returns the
 * same withdrawal instead of moving the sats twice. A refusal moved nothing, so the next
 * try starts a new move with a new key.
 */
export const useCardWithdrawal = ({
  onSuccess,
}: {
  onSuccess: () => void
}): CardWithdrawal => {
  const { LL } = useI18nContext()
  const guard = useInFlightGuard()
  const [withdraw, { loading }] = useCardCollateralWithdrawMutation()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const idempotencyKeyRef = useRef<string | null>(null)

  const fail = (message: string) => {
    setErrorMessage(message)
    triggerHapticFeedback("notificationError")
  }

  const refuse = () => {
    idempotencyKeyRef.current = null
    fail(LL.CardFlow.CardBalanceTransfer.insufficient())
  }

  const execute = async ({ amountSats }: { amountSats: number }) => {
    await guard.run(async () => {
      setErrorMessage(undefined)

      try {
        /** Minted at the swipe, not while rendering: a throw from the native call is
         *  caught here and shown, where during render it would unmount the app. */
        const idempotencyKey = idempotencyKeyRef.current ?? Crypto.randomUUID()
        idempotencyKeyRef.current = idempotencyKey

        const { data } = await withdraw({
          variables: { input: { amountSats, idempotencyKey } },
          refetchQueries: [HomeAuthedDocument],
        })
        const status = data?.cardCollateralWithdraw.status

        if (status && MOVED_STATUSES.has(status)) {
          triggerHapticFeedback("notificationSuccess")
          onSuccess()
          return
        }
        if (status === CardCollateralWithdrawalStatus.Refused) {
          refuse()
          return
        }
        if (status === CardCollateralWithdrawalStatus.InReview) {
          recordAppError(new Error("Card withdrawal in review"))
          fail(LL.CardFlow.CardBalanceTransfer.inReview())
          return
        }
        fail(LL.common.error())
      } catch (err) {
        if (isInsufficientBalance(err)) {
          refuse()
          return
        }
        const withdrawalError = toError(err)
        recordAppError(withdrawalError)
        fail(withdrawalError.message)
      }
    })
  }

  return { execute, loading, errorMessage }
}
