import { useCallback, useEffect } from "react"
import { ApolloError, gql } from "@apollo/client"
import { GraphQLFormattedError } from "graphql"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
  useCardCollateralDepositIntentCreateMutation,
  useCardCollateralDepositIntentQuery,
} from "@app/graphql/generated"

gql`
  mutation cardCollateralDepositIntentCreate(
    $input: CardCollateralDepositIntentCreateInput!
  ) {
    cardCollateralDepositIntentCreate(input: $input) {
      intentId
      method
      destination
      expiresAt
    }
  }

  query cardCollateralDepositIntent($intentId: ID!) {
    cardCollateralDepositIntent(intentId: $intentId) {
      id
      status
      creditedSats
    }
  }
`

export type CardDepositIntentError = {
  /** blink-card's code, such as RATE_LIMIT_EXCEEDED; none for a request that failed on
   *  the way. */
  code?: string
  message: string
  /** How long blink-card asks to wait before the next create, with RATE_LIMIT_EXCEEDED. */
  retryAfterSeconds?: number
}

export type CardDepositIntent = {
  intentId: string
  method: CardCollateralDepositMethod
  /** The invoice to pay for a Lightning deposit, the address for an onchain one. */
  destination: string
  expiresAt: string
}

export type CardDepositIntentResult =
  | { intent: CardDepositIntent; error?: undefined }
  | { intent?: undefined; error: CardDepositIntentError }

const STATUS_POLL_INTERVAL_MS = 5000

const FINAL_STATUSES: ReadonlySet<CardCollateralDepositIntentStatus> = new Set([
  CardCollateralDepositIntentStatus.Consumed,
  CardCollateralDepositIntentStatus.Expired,
  CardCollateralDepositIntentStatus.Failed,
])

const errorOfGraphql = ({
  message,
  extensions,
}: GraphQLFormattedError): CardDepositIntentError => {
  const code = typeof extensions?.code === "string" ? extensions.code : undefined
  const retryAfter = extensions?.retryAfterSeconds
  const retryAfterSeconds = typeof retryAfter === "number" ? retryAfter : undefined
  return { code, message, retryAfterSeconds }
}

const errorOf = (err: unknown): CardDepositIntentError => {
  const graphqlError = err instanceof ApolloError ? err.graphQLErrors[0] : undefined
  if (graphqlError) return errorOfGraphql(graphqlError)
  const message = err instanceof Error ? err.message : String(err)
  return { message }
}

/** Asks blink-card where to send a deposit into the Card Balance. It never throws: a
 *  refusal comes back as the error, with blink-card's code for the caller to act on. */
export const useCardDepositIntentCreate = () => {
  const [createIntent, { loading }] = useCardCollateralDepositIntentCreateMutation()

  const create = useCallback(
    async (
      amountSats: number,
      method: CardCollateralDepositMethod,
    ): Promise<CardDepositIntentResult> => {
      try {
        const { data } = await createIntent({
          variables: { input: { amountSats, method } },
        })
        const created = data?.cardCollateralDepositIntentCreate
        if (!created) return { error: { message: "No deposit intent was created" } }
        return {
          intent: {
            intentId: created.intentId,
            method: created.method,
            destination: created.destination,
            expiresAt: created.expiresAt,
          },
        }
      } catch (err) {
        return { error: errorOf(err) }
      }
    },
    [createIntent],
  )

  return { create, loading }
}

/** Follows a deposit until it is credited, expires or fails. An intent blink-card
 *  doesn't know yet reads as unknown and is asked again. */
export const useCardDepositIntentStatus = (intentId: string | undefined) => {
  const isFollowed = intentId !== undefined
  const { data, startPolling, stopPolling } = useCardCollateralDepositIntentQuery({
    variables: { intentId: intentId ?? "" },
    skip: !isFollowed,
    fetchPolicy: "network-only",
  })

  const intent = data?.cardCollateralDepositIntent
  const status = intent?.status
  const isFinal = status !== undefined && FINAL_STATUSES.has(status)
  const isWaiting = isFollowed && !isFinal

  useEffect(() => {
    if (!isWaiting) return undefined
    startPolling(STATUS_POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [isWaiting, startPolling, stopPolling])

  return { status, creditedSats: intent?.creditedSats, isFinal }
}
