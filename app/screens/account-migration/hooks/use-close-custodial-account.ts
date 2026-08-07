import { useCallback } from "react"

import { useAccountDeleteMutation } from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/is-network-failure"
import { MigrationRejectionCode } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { toError } from "@app/utils/error-reporting"

const UNAUTHENTICATED_STATUS = 401

const UNKNOWN_ACCOUNT_ID = "unknown"

const propertyOf = (candidate: unknown, property: string): unknown =>
  candidate && typeof candidate === "object" && property in candidate
    ? (candidate as Record<string, unknown>)[property]
    : undefined

const statusCodeOf = (candidate: unknown): unknown => propertyOf(candidate, "statusCode")

/** Duck-typed like `isNetworkFailure`, not gated on `instanceof ApolloError`: a second copy
 *  of @apollo/client makes the instance check false for a real one, and the 401 would then
 *  fall through to the network branch and earn a retry that can only 401 again. */
const isUnauthenticated = (err: unknown): boolean =>
  statusCodeOf(err) === UNAUTHENTICATED_STATUS ||
  statusCodeOf(propertyOf(err, "networkError")) === UNAUTHENTICATED_STATUS

/** `reportError` forwards nothing but the Error's message to Crashlytics, so the label and
 *  the account id have to travel inside it. The original stack is kept. */
const reportClose = (
  label: string,
  detail: unknown,
  custodialAccountId: string | null,
): void => {
  const error = toError(detail)
  const report = new Error(
    `${label}: ${error.message} (accountId: ${custodialAccountId ?? UNKNOWN_ACCOUNT_ID})`,
  )
  report.stack = error.stack
  reportError(label, report)
}

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
 * Only a successful payload counts as closed: being wrong in that direction leaves a live
 * custodial account behind an app that reported success, with nobody looking for it.
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
          (rejection) => rejection.code === MigrationRejectionCode.StateConflict,
        )
        if (isTransferInFlight) return AccountCloseOutcome.Retryable

        const [rejection] = rejections

        /** A settled response with no payload is not a refusal: the answer never arrived,
         *  so it earns a retry rather than burning the window on the strength of no answer. */
        if (!rejection) {
          reportClose(
            "Migration account close empty payload",
            new Error("accountDelete returned neither success nor an error"),
            custodialAccountId,
          )
          return AccountCloseOutcome.Retryable
        }

        const isDeletionCapped = rejections.some(
          (candidate) => candidate.code === MigrationRejectionCode.OperationRestricted,
        )
        const rejectionLabel = isDeletionCapped
          ? "Migration account close capped"
          : "Migration account close rejected"
        reportClose(rejectionLabel, rejection.message, custodialAccountId)

        return AccountCloseOutcome.Refused
      } catch (err) {
        /** The token was rejected before the mutation ran, so nothing was deleted and no
         *  later call can authenticate either. Refused, not closed: the transport no longer
         *  resends this mutation, so a 401 is never the echo of an attempt that landed. */
        if (isUnauthenticated(err)) {
          reportClose("Migration account close unauthenticated", err, custodialAccountId)
          return AccountCloseOutcome.Refused
        }

        /** A mutation the network never delivered can still land, so support never hears
         *  about it and the caller keeps its retry. */
        if (isNetworkFailure(err)) return AccountCloseOutcome.Retryable

        reportClose("Migration account close failed", err, custodialAccountId)
        return AccountCloseOutcome.Refused
      }
    },
    [deleteAccount],
  )

  return { closeCustodialAccount }
}
