import { useCallback, useEffect, useState } from "react"

import { gql } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { MigrationStatus, useMigrationCommitMutation } from "@app/graphql/generated"
import { isDeviceClockSkewed } from "@app/graphql/server-time"
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

/** The backend gives a stale proof and a bad destination the same code; the clock skew
 *  tells them apart, and any other code falls through to support (fail-safe). */
const STALE_PROOF_REJECTION_CODE = "MIGRATION_INVALID_DESTINATION"

/**
 * Custodial accounts whose commit has already fired this session. Unlike a per-mount ref
 * this survives a remount, so a screen that re-mounts while the first commit is still in
 * flight cannot fire a second one with a fresh invoice, which the backend refuses as a
 * state conflict. A genuine relaunch starts empty but reads TRANSFERRING, which already
 * blocks a re-commit.
 */
const accountsWithCommitStarted = new Set<string>()

/** Clears the module-level commit guard; for test isolation, never called in production. */
export const resetMigrationCommitGuard = (): void => {
  accountsWithCommitStarted.clear()
}

type UseMigrationTransferArgs = {
  custodialAccountId: string | null
  selfCustodialAccountId: string | null
  skip: boolean
}

type UseMigrationTransfer = {
  isTransferred: boolean
  failureReason: MigrationSupportReason | null
  isClockOutOfSync: boolean
  retry: () => void
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
  const [isClockOutOfSync, setIsClockOutOfSync] = useState(false)

  /**
   * Polling stops for good once there is nothing left to watch: a terminal phase, a
   * client-side failure, or a caller that is skipping. Reading `migration` runs the
   * server's resume routine every time and this screen stays mounted under the one it
   * hands over to, so an unstopped poll would hammer the server forever. `pollInterval: 0`
   * rather than `undefined` because Apollo drops an undefined option in its options merge,
   * leaving the previous interval in place, where 0 actually clears the timer.
   */
  const [hasStopped, setHasStopped] = useState(false)

  /** Also paused while out of sync: nothing advances until the retry fires a fresh commit,
   *  so polling would only re-run the server's resume routine for nothing. */
  const shouldStopPolling = hasStopped || isClockOutOfSync
  const { status } = useMigrationStatus({
    skip,
    pollInterval: shouldStopPolling ? 0 : STATUS_POLL_INTERVAL_MS,
  })

  const hasServerFailed = status === MigrationStatus.Failed

  /** A failure already handed the user to support, so a later COMPLETED from a stray poll
   *  must not also swap the session out from under that screen. */
  const isTransferred = status === MigrationStatus.Completed && failureReason === null

  useEffect(() => {
    if (isTransferred || hasServerFailed || failureReason !== null) setHasStopped(true)
  }, [isTransferred, hasServerFailed, failureReason])

  const fail = useCallback((reason: MigrationSupportReason, err: unknown) => {
    reportError("Migration transfer", err)
    setFailureReason(reason)
  }, [])

  const commit = useCallback(
    async (custodialId: string, selfCustodialId: string) => {
      const proofTimestamp = currentProofTimestamp()
      const result = await buildMigrationTransferRequest({
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
      if (!rejection) return

      /** A skewed clock makes the proof stale, which the backend rejects under the
       *  bad-destination code; that code plus a real skew is what earns a retry rather
       *  than a handover to support. */
      const isStaleProofRejection =
        rejection.code === STALE_PROOF_REJECTION_CODE && isDeviceClockSkewed()
      if (isStaleProofRejection) {
        setIsClockOutOfSync(true)
        return
      }
      fail(MigrationSupportReason.TransferFailed, new Error(rejection.message))
    },
    [network, selfCustodialDepositClaimLeewayVbyte, commitMigration, fail],
  )

  /** The server is waiting for a destination only while IN_PROGRESS: TRANSFERRING already
   *  has one, and committing a second invoice is refused as a state conflict. */
  const isAwaitingDestination = status === MigrationStatus.InProgress
  const hasFailed = failureReason !== null
  /** `!isClockOutOfSync` also re-arms the commit: clearing it on retry flips canCommit
   *  back to true and re-fires the effect, which the module guard alone would not. */
  const canCommit = isAwaitingDestination && !skip && !hasFailed && !isClockOutOfSync

  useEffect(() => {
    if (!canCommit) return

    /** Both ids checked before the guard is claimed, so a transient null never latches
     *  out a commit that could still fire once the id arrives. */
    if (!custodialAccountId || !selfCustodialAccountId) return
    if (accountsWithCommitStarted.has(custodialAccountId)) return

    accountsWithCommitStarted.add(custodialAccountId)
    commit(custodialAccountId, selfCustodialAccountId).catch((err) =>
      fail(MigrationSupportReason.TransferFailed, err),
    )
  }, [canCommit, custodialAccountId, selfCustodialAccountId, commit, fail])

  /** FAILED has no client-side way back: the phase machine only leaves it when a late
   *  payment settles server-side, so offering a retry would loop on a refusal. */
  const serverFailure = hasServerFailed ? MigrationSupportReason.TransferFailed : null

  /** After the clock is corrected, a fresh commit can pass: drop the once-only guard and
   *  clear the flag so the commit effect fires again with a new timestamp. */
  const retry = useCallback(() => {
    if (custodialAccountId) accountsWithCommitStarted.delete(custodialAccountId)
    setIsClockOutOfSync(false)
  }, [custodialAccountId])

  /** Clock-fix and support are mutually exclusive: while out of sync the user has a retry,
   *  so a server failure on the same render must not also route to support. */
  const activeFailureReason = isClockOutOfSync ? null : failureReason ?? serverFailure

  return {
    isTransferred,
    failureReason: activeFailureReason,
    isClockOutOfSync,
    retry,
  }
}
