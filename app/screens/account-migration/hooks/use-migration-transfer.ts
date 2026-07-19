import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { MigrationStatus, useMigrationCommitMutation } from "@app/graphql/generated"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  buildMigrationTransferRequest,
  MigrationTransferRequestStatus,
} from "@app/self-custodial/migration-transfer-request"
import { MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import {
  buildMigrationProofChallenge,
  currentProofTimestamp,
} from "../utils/migration-proof"

import { useMigrationStatus } from "./use-migration-status"

gql`
  mutation migrationCommit($input: MigrationCommitInput!) {
    migrationCommit(input: $input) {
      errors {
        message
        code
      }
    }
  }
`

/**
 * Which disclosure the user accepted before committing. Bump it whenever the migration's
 * explainer or terms copy changes materially: the backend stores it verbatim, and it is
 * the only record of what was agreed to.
 */
const DISCLOSURE_VERSION = "v1"

/** The server settles a drain in seconds, so the phase is re-read often enough to feel
 *  immediate without turning a slow settle into a burst of reads. */
const STATUS_POLL_INTERVAL_MS = 2000

type UseMigrationTransferArgs = {
  custodialAccountId: string | null
  selfCustodialAccountId: string | null
  skip: boolean
}

type UseMigrationTransfer = {
  isTransferred: boolean
  failureReason: MigrationSupportReason | null
}

/**
 * Runs the transfer to its end: it commits when the server is still waiting for a
 * destination, then watches the phase until it settles. Committing is driven by the
 * server's own phase rather than by anything remembered locally, which is what makes a
 * relaunch mid-transfer safe: a flow already TRANSFERRING is only watched, never
 * re-committed with a second invoice the backend would refuse.
 */
export const useMigrationTransfer = ({
  custodialAccountId,
  selfCustodialAccountId,
  skip,
}: UseMigrationTransferArgs): UseMigrationTransfer => {
  const network = useSparkNetwork()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()
  const [commitMigration] = useMigrationCommitMutation()
  const [failureReason, setFailureReason] = useState<MigrationSupportReason | null>(null)
  const hasCommittedRef = useRef(false)

  /** Polling stops for good once the phase settles: reading `migration` runs the server's
   *  resume routine every time, and this screen stays mounted under the one it hands over
   *  to, so a finished transfer would otherwise be watched forever. */
  const [hasSettled, setHasSettled] = useState(false)
  const { status } = useMigrationStatus({
    pollInterval: hasSettled ? undefined : STATUS_POLL_INTERVAL_MS,
  })

  const isTransferred = status === MigrationStatus.Completed
  const hasServerFailed = status === MigrationStatus.Failed

  useEffect(() => {
    if (!isTransferred && !hasServerFailed) return
    setHasSettled(true)
  }, [isTransferred, hasServerFailed])

  const fail = useCallback((reason: MigrationSupportReason, err: unknown) => {
    reportError("Migration transfer", err)
    setFailureReason(reason)
  }, [])

  const commit = useCallback(async () => {
    if (!custodialAccountId || !selfCustodialAccountId) return

    const proofTimestamp = currentProofTimestamp()
    const result = await buildMigrationTransferRequest({
      accountId: selfCustodialAccountId,
      network,
      leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
      signChallenge: (sparkPubkey) =>
        buildMigrationProofChallenge({
          custodialAccountId,
          sparkPubkey,
          timestamp: proofTimestamp,
        }),
    })

    if (result.status === MigrationTransferRequestStatus.NoMnemonic) {
      fail(
        MigrationSupportReason.SelfCustodialAccountMissing,
        new Error("No mnemonic for the provisioned account"),
      )
      return
    }

    if (result.status === MigrationTransferRequestStatus.Failed) {
      fail(MigrationSupportReason.TransferFailed, result.error)
      return
    }

    const { data } = await commitMigration({
      variables: {
        input: {
          ...result.request,
          proofTimestamp,
          backupAttested: true,
          disclosureVersion: DISCLOSURE_VERSION,
        },
      },
    })

    const [rejection] = data?.migrationCommit.errors ?? []
    if (rejection) {
      fail(MigrationSupportReason.TransferFailed, new Error(rejection.message))
    }
  }, [
    custodialAccountId,
    selfCustodialAccountId,
    network,
    selfCustodialDepositClaimLeewayVbyte,
    commitMigration,
    fail,
  ])

  /** The server is waiting for a destination only while IN_PROGRESS: TRANSFERRING already
   *  has one, and committing a second invoice is refused as a state conflict. */
  const isAwaitingDestination = status === MigrationStatus.InProgress
  const hasFailed = failureReason !== null

  useEffect(() => {
    const shouldCommit = isAwaitingDestination && !skip && !hasFailed
    if (!shouldCommit || hasCommittedRef.current) return

    /** Claimed before the request goes out, since the commit is single-shot server-side. */
    hasCommittedRef.current = true
    commit().catch((err) => fail(MigrationSupportReason.TransferFailed, err))
  }, [isAwaitingDestination, skip, hasFailed, commit, fail])

  /** FAILED has no client-side way back: the phase machine only leaves it when a late
   *  payment settles server-side, so offering a retry would loop on a refusal. */
  const serverFailure = hasServerFailed ? MigrationSupportReason.TransferFailed : null

  return {
    isTransferred,
    failureReason: failureReason ?? serverFailure,
  }
}
