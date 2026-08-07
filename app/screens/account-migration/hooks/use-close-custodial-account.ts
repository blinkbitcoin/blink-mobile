import { useCallback } from "react"

import { ApolloError } from "@apollo/client"

import { useAccountDeleteMutation } from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/is-network-failure"
import { reportError } from "@app/utils/error-logging"

/** Refused while a transfer is still draining. Transient by contract. */
const MIGRATION_STATE_CONFLICT_CODE = "MIGRATION_STATE_CONFLICT"

/** The phone-deletion cap, carrying the server's own contact-support copy. */
const OPERATION_RESTRICTED_CODE = "OPERATION_RESTRICTED"

const UNAUTHENTICATED_STATUS = 401

const statusCodeOf = (candidate: unknown): number | undefined =>
  candidate && typeof candidate === "object" && "statusCode" in candidate
    ? (candidate as { statusCode?: number }).statusCode
    : undefined

/** A 401 on the very call that deletes the account: the token it authenticated with is
 *  already dead, so the deletion landed and only its answer was lost. No later call can
 *  authenticate either, so treating this as retryable would 401 forever. */
const isTokenDead = (err: unknown): boolean =>
  statusCodeOf(err) === UNAUTHENTICATED_STATUS ||
  (err instanceof ApolloError &&
    statusCodeOf(err.networkError) === UNAUTHENTICATED_STATUS)

/** retryable = nothing settled server-side, so the token is still alive and a later attempt
 *  can land; refused = the server settled on no, and replaying only repeats the answer. */
export const AccountCloseOutcome = {
  Closed: "closed",
  Retryable: "retryable",
  Refused: "refused",
} as const

export type AccountCloseOutcome =
  (typeof AccountCloseOutcome)[keyof typeof AccountCloseOutcome]

/**
 * Closes the custodial account a completed migration emptied, with the same `accountDelete`
 * mutation the settings screen uses (its document is declared there, because codegen allows
 * only one per operation name). The server closes the account and deletes the Kratos
 * identity, so the token this call authenticates with dies the moment it succeeds. It
 * classifies the answer and nothing else: what a non-closed outcome costs is the caller's
 * to decide.
 *
 * A refusal is reported with the account id, because that report is the only trace of an
 * account the migration left open and support has to remove by hand.
 */
export const useCloseCustodialAccount = () => {
  const [deleteAccount] = useAccountDeleteMutation({ fetchPolicy: "no-cache" })

  const closeCustodialAccount = useCallback(
    async (custodialAccountId: string | null): Promise<AccountCloseOutcome> => {
      try {
        const { data } = await deleteAccount()
        const payload = data?.accountDelete

        if (payload?.success) return AccountCloseOutcome.Closed

        const rejections = payload?.errors ?? []

        /** Every code is read, not just the first: a conflict behind another error is still
         *  a conflict, and misreading it as terminal would spend the close's one window. */
        const isTransferInFlight = rejections.some(
          (rejection) => rejection.code === MIGRATION_STATE_CONFLICT_CODE,
        )
        if (isTransferInFlight) return AccountCloseOutcome.Retryable

        const [rejection] = rejections

        /** A settled response with no payload is not a refusal: the answer never arrived,
         *  so it earns a retry rather than burning the window on the strength of no answer. */
        if (!rejection) {
          reportError(
            "Migration account close empty payload",
            new Error("accountDelete returned neither success nor an error"),
          )
          return AccountCloseOutcome.Retryable
        }

        const isDeletionCapped = rejections.some(
          (candidate) => candidate.code === OPERATION_RESTRICTED_CODE,
        )
        const rejectionName = isDeletionCapped
          ? "Migration account close capped"
          : "Migration account close rejected"
        reportError(
          rejectionName,
          new Error(
            `${rejection.message} (accountId: ${custodialAccountId ?? "unknown"})`,
          ),
        )

        return AccountCloseOutcome.Refused
      } catch (err) {
        if (isTokenDead(err)) {
          reportError("Migration account close unacknowledged", err)
          return AccountCloseOutcome.Closed
        }

        /** A mutation the network never delivered can still land, so support never hears
         *  about it and the caller keeps its retry. */
        if (isNetworkFailure(err)) return AccountCloseOutcome.Retryable

        reportError("Migration account close failed", err)
        return AccountCloseOutcome.Refused
      }
    },
    [deleteAccount],
  )

  return { closeCustodialAccount }
}
