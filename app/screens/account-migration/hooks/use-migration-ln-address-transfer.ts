import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import {
  MigrationLnAddressTransferStatus,
  useMigrationLnAddressTransferMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  buildMigrationLnAddressProof,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { reportError } from "@app/utils/error-logging"
import { withTimeout } from "@app/utils/with-timeout"

import {
  buildMigrationProofChallenge,
  currentProofTimestamp,
} from "../utils/migration-proof"

gql`
  mutation migrationLnAddressTransfer($input: MigrationLnAddressTransferInput!) {
    migrationLnAddressTransfer(input: $input) {
      errors {
        message
        code
      }
      results {
        identifier
        lightningAddress
        status
      }
    }
  }
`

/**
 * How long the re-point may take before the screen treats it as unsettled. The proof is
 * built through the SDK, which connects and signs under a per-storage-dir lock and can
 * stall without ever throwing; an attempt that never answers used to leave Approve
 * disabled with nothing on screen to act on, since only a settled outcome reports
 * anything. Generous enough for a cold connect on a slow network, short enough that the
 * user is offered the retry rather than left reading a dead button.
 */
export const LN_ADDRESS_TRANSFER_TIMEOUT_MS = 45_000

type UseMigrationLnAddressTransferArgs = {
  custodialAccountId: string | null
  selfCustodialAccountId: string | null
  skip: boolean
}

type UseMigrationLnAddressTransfer = {
  isTransferred: boolean
  isRejected: boolean
  /** No device key for the account (reinstall); distinct so the screen reuses the commit reason. */
  isAccountMissing: boolean
  hasConnectionIssue: boolean
  retry: () => void
}

/** transferred = every identifier settled (moved, already moved, or nothing to move);
 *  connection-issue = the network never delivered the mutation, so a retry can still land;
 *  account-missing = the device has no key for the account (a reinstall), the same cause the
 *  commit reports; rejected = any other settled failure a retry only replays, so support
 *  takes over. */
const LnAddressOutcome = {
  Transferred: "transferred",
  ConnectionIssue: "connection-issue",
  AccountMissing: "account-missing",
  Rejected: "rejected",
  /** The bound ran out before the attempt answered. Carried apart from the kinds above so
   *  the report it earns is filed where superseded answers are already dropped. */
  Stalled: "stalled",
} as const

type LnAddressOutcome = (typeof LnAddressOutcome)[keyof typeof LnAddressOutcome]

/**
 * Re-points the custodial lightning address(es) onto the freshly migrated self-custodial
 * account, once per visit to the commit screen. It signs the same proof of possession the
 * commit does and reads the per-identifier results: anything but an outright FAILED (or a
 * top-level rejection) is a settled outcome, since ALREADY_TRANSFERRED and
 * SKIPPED_NOT_REGISTERED mean there was nothing left to move. The backend mutation is
 * idempotent, so a retry after a dropped network never double-registers.
 */
export const useMigrationLnAddressTransfer = ({
  custodialAccountId,
  selfCustodialAccountId,
  skip,
}: UseMigrationLnAddressTransferArgs): UseMigrationLnAddressTransfer => {
  const network = useSparkNetwork()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()
  const [transferLnAddress] = useMigrationLnAddressTransferMutation()

  const [isTransferred, setIsTransferred] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [isAccountMissing, setIsAccountMissing] = useState(false)
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false)
  const [attempt, setAttempt] = useState(0)

  /** Which attempt already went out, claimed before the request rather than after it
   *  answers, so an unstable mutate identity or an extra render cannot fire a second one
   *  or turn a failure into a loop. */
  const firedAttemptRef = useRef(-1)

  /** An outcome may only be dropped once there is no one left to report it to. Claimed on
   *  mount, not just released on unmount, so a remount that reuses the ref (a double mount
   *  under StrictMode or a fast refresh) does not start out reporting to nobody. */
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Only an unsettled connection issue retries: a settled rejection or a missing device key
   * would replay the same answer, and a completed transfer would re-run the expensive
   * connect-and-sign for nothing (the shared retry fires for any of the screen's sources).
   *
   * An attempt still in the air is deliberately NOT excluded: after a stall the next one
   * queues behind it on the per-directory lock, which is exactly what lets a merely slow
   * connect-and-sign be followed by an attempt that lands once it finishes.
   */
  const retry = useCallback(() => {
    if (isRejected || isTransferred || isAccountMissing) return
    setHasConnectionIssue(false)
    setAttempt((previous) => previous + 1)
  }, [isRejected, isTransferred, isAccountMissing])

  const run = useCallback(
    async (custodialId: string, selfCustodialId: string): Promise<LnAddressOutcome> => {
      const proofTimestamp = currentProofTimestamp()
      const proof = await buildMigrationLnAddressProof({
        accountId: selfCustodialId,
        network,
        leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
        signChallenge: (sparkPubkey) =>
          buildMigrationProofChallenge({
            custodialAccountId: custodialId,
            sparkPubkey,
            timestamp: proofTimestamp,
          }),
      })

      /** A dropped connection during the connect or the sign can be sent again, so it
       *  offers the shared retry rather than handing the user to support. */
      if (proof.status === MigrationSdkStatus.ConnectionError)
        return LnAddressOutcome.ConnectionIssue

      /** No device key (reinstall): hand over as account-missing, like the commit path. */
      if (proof.status === MigrationSdkStatus.NoMnemonic) {
        reportError(
          "Migration ln-address account missing",
          new Error("No mnemonic for the provisioned account"),
        )
        return LnAddressOutcome.AccountMissing
      }

      if (proof.status !== MigrationSdkStatus.Ok) {
        reportError("Migration ln-address proof", proof.error)
        return LnAddressOutcome.Rejected
      }

      try {
        const { data } = await transferLnAddress({
          variables: {
            input: {
              proofSignature: proof.value.proofSignature,
              proofTimestamp,
              sparkPubkey: proof.value.sparkPubkey,
            },
          },
        })

        const payload = data?.migrationLnAddressTransfer
        if (!payload) {
          reportError(
            "Migration ln-address empty payload",
            new Error("migrationLnAddressTransfer returned no payload"),
          )
          return LnAddressOutcome.Rejected
        }

        const [rejection] = payload.errors
        const failedResults = payload.results.filter(
          (result) => result.status === MigrationLnAddressTransferStatus.Failed,
        )

        if (rejection)
          reportError("Migration ln-address rejected", new Error(rejection.message))
        if (failedResults.length > 0)
          reportError(
            "Migration ln-address result failed",
            new Error(failedResults.map((result) => result.identifier).join(", ")),
          )
        if (rejection || failedResults.length > 0) return LnAddressOutcome.Rejected

        return LnAddressOutcome.Transferred
      } catch (err) {
        const isRetryable = isNetworkFailure(err)

        /** A mutation the network never delivered can still land, so support never hears
         *  about it; the caller's retry is what sends the next one. */
        if (!isRetryable) reportError("Migration ln-address failed", err)
        return isRetryable ? LnAddressOutcome.ConnectionIssue : LnAddressOutcome.Rejected
      }
    },
    [network, selfCustodialDepositClaimLeewayVbyte, transferLnAddress],
  )

  useEffect(() => {
    if (skip || firedAttemptRef.current === attempt) return

    /** Both ids checked before the attempt is claimed, so a transient null never latches
     *  out a transfer that could still fire once the id arrives. */
    if (!custodialAccountId || !selfCustodialAccountId) return

    firedAttemptRef.current = attempt

    /** `run` settles every failure it can name, but the proof is built before its own try:
     *  a keychain that throws rejects it, which is a settled failure a retry only replays,
     *  not the wait running out. Named apart so the bound below is the only thing left that
     *  can reject, and so support is never told an attempt stalled that in fact threw. */
    const settledAttempt = run(custodialAccountId, selfCustodialAccountId).catch(
      (err) => {
        reportError("Migration ln-address threw", err)
        return LnAddressOutcome.Rejected
      },
    )

    const attemptWithinBound = withTimeout(
      settledAttempt,
      LN_ADDRESS_TRANSFER_TIMEOUT_MS,
      "Migration ln-address re-point",
    ).catch(() => LnAddressOutcome.Stalled)

    /**
     * Dropped only when something newer owns the answer: the hook is gone, or a later
     * attempt was claimed and this one is superseded. Not when the effect merely re-ran,
     * which an id flickering null mid-flight does: the re-run cannot fire again against
     * the claimed attempt number, so dropping the answer already in the air would leave
     * every flag false for good, the exact silence this hook exists to report, and one no
     * bound can rescue since the timeout's own outcome would go with it.
     *
     * A stall is reported here rather than where it is raised, so one incident files one
     * report: an attempt left behind by a retry or an unmount still times out, and the
     * answer nobody reads has nothing to tell support.
     *
     * It settles as a connection issue however often it happens, never as a rejection: the
     * attempt may still be in the air, and the screen that reads this keeps its own
     * contact-support button on screen throughout, so a retry that cannot land is never the
     * user's only way out.
     */
    attemptWithinBound.then((outcome) => {
      if (!isMountedRef.current || firedAttemptRef.current !== attempt) return

      if (outcome === LnAddressOutcome.Stalled) {
        reportError(
          "Migration ln-address stalled",
          new Error(`Re-point did not answer within ${LN_ADDRESS_TRANSFER_TIMEOUT_MS}ms`),
        )
        setHasConnectionIssue(true)
        return
      }

      if (outcome === LnAddressOutcome.Transferred) setIsTransferred(true)
      else if (outcome === LnAddressOutcome.ConnectionIssue) setHasConnectionIssue(true)
      else if (outcome === LnAddressOutcome.AccountMissing) setIsAccountMissing(true)
      else setIsRejected(true)
    })
  }, [skip, attempt, custodialAccountId, selfCustodialAccountId, run])

  return { isTransferred, isRejected, isAccountMissing, hasConnectionIssue, retry }
}
