import { useCallback } from "react"

import { useAccountDeleteMutation } from "@app/graphql/generated"
import { isNetworkFailure, isUnauthorizedError } from "@app/graphql/transport-error"
import { MigrationRejectionCode } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { RecordAppErrorOptions, toError } from "@app/utils/error-reporting"

const UNKNOWN_ACCOUNT_ID = "unknown"

/** The one repeatable report here, so it is the one that needs a key: the user can press
 *  the transfer screen's retry as often as they like. */
const EMPTY_PAYLOAD_DEDUP_KEY = "migration-close-empty-payload"

/** Names the doubt rather than the 401: the account behind the ticket may already be gone. */
const CLOSE_UNVERIFIABLE_REPORT =
  "Migration account close unverifiable, account may already be deleted"

type CloseReport = Pick<RecordAppErrorOptions, "dedupKey"> & {
  custodialAccountId: string | null
}

/** `reportError` forwards nothing but the Error's message to Crashlytics, so the label and
 *  the account id have to travel inside it. The original stack is kept.
 *
 *  `alwaysRecord` because a close that did not land is exactly what on-call has to see: the
 *  connectivity downgrade would otherwise turn "Migration account close failed: request
 *  timed out" into a breadcrumb, leaving a support ticket with no non-fatal to match it to. */
const reportClose = (
  label: string,
  detail: unknown,
  { custodialAccountId, dedupKey }: CloseReport,
): void => {
  const error = toError(detail)
  const report = new Error(
    `${label}: ${error.message} (accountId: ${custodialAccountId ?? UNKNOWN_ACCOUNT_ID})`,
  )
  report.stack = error.stack
  reportError(label, report, { alwaysRecord: true, dedupKey })
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

        const [firstRejection] = rejections

        /** A settled response with no payload is not a refusal: the answer never arrived,
         *  so it earns a retry rather than burning the window on the strength of no answer. */
        if (!firstRejection) {
          reportClose(
            "Migration account close empty payload",
            new Error("accountDelete returned neither success nor an error"),
            { custodialAccountId, dedupKey: EMPTY_PAYLOAD_DEDUP_KEY },
          )
          return AccountCloseOutcome.Retryable
        }

        /** The cap is looked up rather than assumed first in the list, so the label and the
         *  message always describe the same rejection: naming a report "capped" and pasting
         *  an unrelated validation error under it is what sends on-call the wrong way. */
        const cappedRejection = rejections.find(
          (candidate) => candidate.code === MigrationRejectionCode.OperationRestricted,
        )
        const reportedRejection = cappedRejection ?? firstRejection
        const rejectionLabel = cappedRejection
          ? "Migration account close capped"
          : "Migration account close rejected"
        reportClose(rejectionLabel, reportedRejection.message, { custodialAccountId })

        return AccountCloseOutcome.Refused
      } catch (err) {
        /** Two states answer the same way here, and the device cannot tell them apart: the
         *  token was rejected before the mutation ran, or an earlier attempt already closed
         *  the account and killed the identity this one authenticates with. That echo
         *  survives the RetryLink change, since the retry the user presses is a fresh call.
         *  Refused either way — a deletion nobody can prove must never read as done — but
         *  reported as unverifiable, because on-call has to check the account still exists
         *  before acting on the ticket. */
        if (isUnauthorizedError(err)) {
          reportClose(CLOSE_UNVERIFIABLE_REPORT, err, { custodialAccountId })
          return AccountCloseOutcome.Refused
        }

        /** A mutation the network never delivered can still land, so support never hears
         *  about it and the caller keeps its retry. */
        if (isNetworkFailure(err)) return AccountCloseOutcome.Retryable

        /** Everything left answered: a GraphQL-level rejection (a dead token surfacing as
         *  "Not Authorized", a resolver refusing) is the server having settled, and the one
         *  thing this hook must never do is hand back a retry for a token that is already
         *  spent. Refused costs a support ticket for an account that is still there; the
         *  other direction costs an account nobody is looking for. */
        reportClose("Migration account close failed", err, { custodialAccountId })
        return AccountCloseOutcome.Refused
      }
    },
    [deleteAccount],
  )

  return { closeCustodialAccount }
}
