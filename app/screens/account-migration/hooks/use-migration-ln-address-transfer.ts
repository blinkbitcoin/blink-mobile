import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import {
  MigrationLnAddressTransferStatus,
  useMigrationLnAddressTransferMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/is-network-failure"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  buildMigrationLnAddressProof,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { reportError } from "@app/utils/error-logging"

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

  /** Only an unsettled connection issue retries: a settled rejection or a missing device key
   *  would replay the same answer, and a completed transfer would re-run the expensive
   *  connect-and-sign for nothing (the shared retry fires for any of the screen's sources). */
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
    let isActive = true

    run(custodialAccountId, selfCustodialAccountId).then((outcome) => {
      if (!isActive) return
      if (outcome === LnAddressOutcome.Transferred) setIsTransferred(true)
      else if (outcome === LnAddressOutcome.ConnectionIssue) setHasConnectionIssue(true)
      else if (outcome === LnAddressOutcome.AccountMissing) setIsAccountMissing(true)
      else setIsRejected(true)
    })

    return () => {
      isActive = false
    }
  }, [skip, attempt, custodialAccountId, selfCustodialAccountId, run])

  return { isTransferred, isRejected, isAccountMissing, hasConnectionIssue, retry }
}
