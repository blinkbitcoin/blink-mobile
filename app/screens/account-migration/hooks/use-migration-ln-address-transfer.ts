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
import { MigrationLnAddressOutcome } from "@app/types/migration"
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
  /** The single state the screen reads: the kinds are mutually exclusive, and the screen
   *  answers each one differently. */
  outcome: MigrationLnAddressOutcome
  retry: () => void
}

/** The bound ran out before the attempt answered. Carried apart from the kinds the screen
 *  reads so the report it earns is filed where superseded answers are already dropped, and
 *  so the screen is never handed a kind it has no answer for: a stall settles as a
 *  connection issue. */
const STALLED = "stalled" as const

type AttemptOutcome = MigrationLnAddressOutcome | typeof STALLED

/** The outcomes a fresh attempt could still change. Everything else is settled: a rejection
 *  or a failed proof would replay the same answer, a missing device key cannot be conjured
 *  back, and a completed transfer would re-run the expensive connect-and-sign for nothing. */
const RETRYABLE_OUTCOMES: ReadonlySet<MigrationLnAddressOutcome> = new Set([
  MigrationLnAddressOutcome.Pending,
  MigrationLnAddressOutcome.ConnectionIssue,
])

/**
 * Re-points the custodial lightning address(es) onto the freshly migrated self-custodial
 * account, once per visit to the commit screen. It signs the same proof of possession the
 * commit does and reads the per-identifier results: anything but an outright FAILED (or a
 * top-level rejection) is a settled outcome, since ALREADY_TRANSFERRED and
 * SKIPPED_NOT_REGISTERED mean there was nothing left to move. The backend mutation is
 * idempotent, so a retry after a dropped network never double-registers.
 *
 * A failure of the address and a failure of the PROOF are reported apart, because the commit
 * shares only the second: it signs the same proof through the same SDK chain, so telling a
 * user whose device cannot sign that their funds will move anyway would be a promise broken
 * moments later. See `MigrationLnAddressOutcome`.
 */
export const useMigrationLnAddressTransfer = ({
  custodialAccountId,
  selfCustodialAccountId,
  skip,
}: UseMigrationLnAddressTransferArgs): UseMigrationLnAddressTransfer => {
  const network = useSparkNetwork()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()
  const [transferLnAddress] = useMigrationLnAddressTransferMutation()

  const [outcome, setOutcome] = useState<MigrationLnAddressOutcome>(
    MigrationLnAddressOutcome.Pending,
  )
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
   * Only an unsettled outcome retries, per `RETRYABLE_OUTCOMES` above (the shared retry
   * fires for any of the screen's sources, so a settled one has to refuse for itself).
   *
   * An attempt still in the air is deliberately NOT excluded: after a stall the next one
   * queues behind it on the per-directory lock, which is exactly what lets a merely slow
   * connect-and-sign be followed by an attempt that lands once it finishes.
   */
  const retry = useCallback(() => {
    if (!RETRYABLE_OUTCOMES.has(outcome)) return
    setOutcome(MigrationLnAddressOutcome.Pending)
    setAttempt((previous) => previous + 1)
  }, [outcome])

  const run = useCallback(
    async (
      custodialId: string,
      selfCustodialId: string,
    ): Promise<MigrationLnAddressOutcome> => {
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
        return MigrationLnAddressOutcome.ConnectionIssue

      /** No device key (reinstall): hand over as account-missing, like the commit path. */
      if (proof.status === MigrationSdkStatus.NoMnemonic) {
        reportError(
          "Migration ln-address account missing",
          new Error("No mnemonic for the provisioned account"),
        )
        return MigrationLnAddressOutcome.AccountMissing
      }

      /** Not a refusal of the address but of the device that had to sign for it, and the
       *  commit signs the same proof through the same chain: it would fail moments later,
       *  so this is the one re-point outcome that still hands the migration over. */
      if (proof.status !== MigrationSdkStatus.Ok) {
        reportError("Migration ln-address proof", proof.error)
        return MigrationLnAddressOutcome.ProofFailed
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

        /** An answer with nothing in it leaves the address unaccounted for, so it settles
         *  as a rejection rather than a success. Not a proof failure: the signature the
         *  commit needs was produced, so the commit is unaffected and stranding the user
         *  over an answer the address never gave would be the dead end this hook avoids. */
        const payload = data?.migrationLnAddressTransfer
        if (!payload) {
          reportError(
            "Migration ln-address empty payload",
            new Error("migrationLnAddressTransfer returned no payload"),
          )
          return MigrationLnAddressOutcome.Rejected
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
        if (rejection || failedResults.length > 0)
          return MigrationLnAddressOutcome.Rejected

        return MigrationLnAddressOutcome.Transferred
      } catch (err) {
        const isRetryable = isNetworkFailure(err)

        /** A mutation the network never delivered can still land, so support never hears
         *  about it; the caller's retry is what sends the next one. A throw that is not the
         *  network is a rejection rather than a proof failure: the proof was already signed
         *  by the time the mutation went out, so the commit still has one. */
        if (!isRetryable) reportError("Migration ln-address failed", err)
        return isRetryable
          ? MigrationLnAddressOutcome.ConnectionIssue
          : MigrationLnAddressOutcome.Rejected
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
     *  a keychain that throws rejects it, which is a failure of the proof the commit signs
     *  too, not the wait running out. Named apart so the bound below is the only thing left
     *  that can reject, and so support is never told an attempt stalled that in fact threw. */
    const settledAttempt: Promise<AttemptOutcome> = run(
      custodialAccountId,
      selfCustodialAccountId,
    ).catch((err) => {
      reportError("Migration ln-address threw", err)
      return MigrationLnAddressOutcome.ProofFailed
    })

    const attemptWithinBound = withTimeout(
      settledAttempt,
      LN_ADDRESS_TRANSFER_TIMEOUT_MS,
      "Migration ln-address re-point",
    ).catch((): AttemptOutcome => STALLED)

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
    attemptWithinBound.then((attemptOutcome) => {
      if (!isMountedRef.current || firedAttemptRef.current !== attempt) return

      if (attemptOutcome === STALLED) {
        reportError(
          "Migration ln-address stalled",
          new Error(`Re-point did not answer within ${LN_ADDRESS_TRANSFER_TIMEOUT_MS}ms`),
        )
        setOutcome(MigrationLnAddressOutcome.ConnectionIssue)
        return
      }

      setOutcome(attemptOutcome)
    })
  }, [skip, attempt, custodialAccountId, selfCustodialAccountId, run])

  return { outcome, retry }
}
