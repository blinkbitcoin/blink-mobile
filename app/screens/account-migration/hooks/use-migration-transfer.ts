import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { gql } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { MigrationStatus, useMigrationCommitMutation } from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { isDeviceClockSkewed } from "@app/graphql/server-time"
import { useLnurlServer } from "@app/self-custodial/hooks/use-lnurl-server"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  buildMigrationTransferRequest,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { MigrationRejectionCode, MigrationSupportReason } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"
import { createExternalStore } from "@app/utils/external-store"

import {
  buildMigrationProofChallenge,
  currentProofTimestamp,
} from "../utils/migration-proof"

import { useMigrationReceiveConfirmation } from "./use-migration-receive-confirmation"
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

/** Where an account's commit stands: sent and not answered (or answered by the phase
 *  moving on), or settled short of the server taking it. */
type CommitRecord =
  | { kind: "sent" }
  | { kind: "connectionIssue" }
  | { kind: "clockOutOfSync" }
  | { kind: "depositPending" }
  | { kind: "failed"; reason: MigrationSupportReason }

/**
 * The commit record of each custodial account this session, keyed by id, and the only
 * place a transfer screen learns how its account's commit went. It outlives the screen
 * that sent the commit, so whichever screen is mounted for the account when the answer
 * lands reads it, and so does one whose account id only resolves afterwards. A record
 * blocks a second commit, which the backend refuses as a state conflict, until the user's
 * retry clears a recoverable one; a failure keeps it for good. A genuine relaunch starts
 * empty but reads TRANSFERRING, which already blocks a re-commit.
 */
const commitRecords = createExternalStore<ReadonlyMap<string, CommitRecord>>(new Map())

const recordCommit = (custodialId: string, record: CommitRecord): void => {
  commitRecords.set(new Map(commitRecords.get()).set(custodialId, record))
}

const releaseCommit = (custodialId: string): void => {
  const next = new Map(commitRecords.get())
  next.delete(custodialId)
  commitRecords.set(next)
}

const failCommit = (
  custodialId: string,
  reason: MigrationSupportReason,
  err: unknown,
): void => {
  reportError("Migration transfer", err)
  recordCommit(custodialId, { kind: "failed", reason })
}

type RecoverableCommitRecord = Extract<
  CommitRecord,
  { kind: "connectionIssue" | "clockOutOfSync" | "depositPending" }
>

const isRecoverableRecord = (
  record: CommitRecord | undefined,
): record is RecoverableCommitRecord =>
  record?.kind === "connectionIssue" ||
  record?.kind === "clockOutOfSync" ||
  record?.kind === "depositPending"

/** Clears every commit record; for test isolation, never called in production. */
export const resetMigrationCommitGuard = (): void => {
  commitRecords.reset()
}

type UseMigrationTransferArgs = {
  custodialAccountId: string | null
  selfCustodialAccountId: string | null
  /** From the checkpoint; null on records saved before the field existed. */
  expectedReceiveSats: number | null
  skip: boolean
}

type UseMigrationTransfer = {
  isTransferred: boolean
  /** Whether the receive was actually seen, as opposed to released by the notice window.
   *  Only the irreversible half of the completion reads it. */
  isReceiveProven: boolean
  isReceiveDelayed: boolean
  failureReason: MigrationSupportReason | null
  isClockOutOfSync: boolean
  hasConnectionIssue: boolean
  /** The commit was refused while an incoming deposit has not confirmed: recoverable, it
   *  clears on a retry once the deposit has landed. */
  isDepositPending: boolean
  retry: () => Promise<void>
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
  expectedReceiveSats,
  skip,
}: UseMigrationTransferArgs): UseMigrationTransfer => {
  const network = useSparkNetwork()
  const { domain: lnurlDomain } = useLnurlServer()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()
  const [commitMigration] = useMigrationCommitMutation()

  const readCommitRecord = useCallback(
    () => (custodialAccountId ? commitRecords.get().get(custodialAccountId) : undefined),
    [custodialAccountId],
  )
  const commitRecord = useSyncExternalStore(
    commitRecords.subscribe,
    readCommitRecord,
    readCommitRecord,
  )
  const failureReason = commitRecord?.kind === "failed" ? commitRecord.reason : null
  const isClockOutOfSync = commitRecord?.kind === "clockOutOfSync"
  const hasConnectionIssue = commitRecord?.kind === "connectionIssue"
  const isDepositPending = commitRecord?.kind === "depositPending"

  /**
   * Polling stops for good once there is nothing left to watch: a terminal phase, a
   * client-side failure, or a caller that is skipping. Reading `migration` runs the
   * server's resume routine every time and this screen stays mounted under the one it
   * hands over to, so an unstopped poll would hammer the server forever. `pollInterval: 0`
   * rather than `undefined` because Apollo drops an undefined option in its options merge,
   * leaving the previous interval in place, where 0 actually clears the timer.
   */
  const [hasStopped, setHasStopped] = useState(false)

  /** Also paused while out of sync or refused for a pending deposit: nothing advances until
   *  the retry fires a fresh commit, so polling would only re-run the server's resume
   *  routine for nothing. */
  const shouldStopPolling = hasStopped || isClockOutOfSync || isDepositPending
  const { status, refetch: refetchStatus } = useMigrationStatus({
    skip,
    pollInterval: shouldStopPolling ? 0 : STATUS_POLL_INTERVAL_MS,
  })

  const hasServerFailed = status === MigrationStatus.Failed
  const isServerCompleted = status === MigrationStatus.Completed
  const hasFailed = failureReason !== null

  /** COMPLETED is the sender's word only; the swap must also wait for the receiver's,
   *  or the user lands in a wallet whose funds are still in transit (#4102). */
  const isReceiveGateSkipped = skip || !isServerCompleted || hasFailed
  const { isReceiveConfirmed, isReceiveProven, isReceiveDelayed } =
    useMigrationReceiveConfirmation({
      selfCustodialAccountId,
      expectedReceiveSats,
      skip: isReceiveGateSkipped,
    })

  /** A failure already handed the user to support, so a later COMPLETED from a stray poll
   *  must not also swap the session out from under that screen. */
  const isTransferred = isServerCompleted && !hasFailed && isReceiveConfirmed

  /** Stops on the server's terminal phase, not on isTransferred: the phase can no longer
   *  change while the receive gate waits, so polling on would only re-run the server's
   *  resume routine for the length of the wait. */
  useEffect(() => {
    const hasServerSettled = isServerCompleted || hasServerFailed
    if (hasServerSettled || hasFailed) setHasStopped(true)
  }, [isServerCompleted, hasServerFailed, hasFailed])

  /** A phase past IN_PROGRESS means the commit did land (the drop hit the response, not the
   *  request): the transfer is under way, so the notice clears and the screen watches it. */
  useEffect(() => {
    const hasAdvancedPastCommit = status !== null && status !== MigrationStatus.InProgress
    if (!hasAdvancedPastCommit || !hasConnectionIssue || !custodialAccountId) return
    recordCommit(custodialAccountId, { kind: "sent" })
  }, [status, hasConnectionIssue, custodialAccountId])

  const commit = useCallback(
    async (custodialId: string, selfCustodialId: string) => {
      const proofTimestamp = currentProofTimestamp()
      const result = await buildMigrationTransferRequest({
        accountId: selfCustodialId,
        network,
        leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
        lnurlDomain,
        signChallenge: (sparkPubkey) =>
          buildMigrationProofChallenge({
            custodialAccountId: custodialId,
            sparkPubkey,
            timestamp: proofTimestamp,
          }),
      })

      if (result.status === MigrationSdkStatus.NoMnemonic) {
        failCommit(
          custodialId,
          MigrationSupportReason.SelfCustodialAccountMissing,
          new Error("No mnemonic for the provisioned account"),
        )
        return
      }

      /** A dropped connection during the connect or the sign can be sent again, so it
       *  pauses on the shared retry rather than handing the user to support. */
      if (result.status === MigrationSdkStatus.ConnectionError) {
        recordCommit(custodialId, { kind: "connectionIssue" })
        return
      }

      if (result.status === MigrationSdkStatus.Failed) {
        failCommit(custodialId, MigrationSupportReason.TransferFailed, result.error)
        return
      }

      const { data } = await commitMigration({
        variables: {
          input: {
            ...result.value,
            proofTimestamp,
            backupAttested: true,
            disclosureVersion: DISCLOSURE_VERSION,
          },
        },
      })

      const [rejection] = data?.migrationCommit?.errors ?? []
      if (!rejection) return

      /** A deposit still confirming refuses the commit until it lands. Nothing moved, so
       *  it pauses on the retry like a skewed clock instead of handing the user to support,
       *  and a screen mounted afterwards picks the pause up too: its OK checks the deposit
       *  before committing, where committing at once would only be refused again. */
      const isPendingDepositRejection =
        rejection.code === MigrationRejectionCode.PendingDeposit
      if (isPendingDepositRejection) {
        recordCommit(custodialId, { kind: "depositPending" })
        return
      }

      /** A skewed clock makes the proof stale, which the backend rejects under the
       *  bad-destination code; that code plus a real skew is what earns a retry rather
       *  than a handover to support. Any other code falls through to support (fail-safe). */
      const isStaleProofRejection =
        rejection.code === MigrationRejectionCode.InvalidDestination &&
        isDeviceClockSkewed()
      if (isStaleProofRejection) {
        recordCommit(custodialId, { kind: "clockOutOfSync" })
        return
      }
      failCommit(
        custodialId,
        MigrationSupportReason.TransferFailed,
        new Error(rejection.message),
      )
    },
    [network, selfCustodialDepositClaimLeewayVbyte, commitMigration, lnurlDomain],
  )

  /** The server is waiting for a destination only while IN_PROGRESS: TRANSFERRING already
   *  has one, and committing a second invoice is refused as a state conflict. */
  const isAwaitingDestination = status === MigrationStatus.InProgress
  /** A recoverable issue (skewed clock, lost connection or pending deposit) pauses the
   *  commit; the retry clearing the record flips canCommit back to true and re-fires the
   *  effect. */
  const hasRecoverableIssue = isRecoverableRecord(commitRecord)
  const canCommit = isAwaitingDestination && !skip && !hasFailed && !hasRecoverableIssue

  useEffect(() => {
    if (!canCommit) return

    /** Both ids checked before the record is written, so a transient null never latches
     *  out a commit that could still fire once the id arrives. */
    if (!custodialAccountId || !selfCustodialAccountId) return
    if (commitRecords.get().has(custodialAccountId)) return

    recordCommit(custodialAccountId, { kind: "sent" })
    commit(custodialAccountId, selfCustodialAccountId).catch((err) => {
      /** A commit lost to the network can still have landed: it earns the shared retry, not
       *  a handover, and it blocks another commit until the retry has re-read the phase. */
      if (isNetworkFailure(err)) {
        recordCommit(custodialAccountId, { kind: "connectionIssue" })
        return
      }
      failCommit(custodialAccountId, MigrationSupportReason.TransferFailed, err)
    })
  }, [canCommit, custodialAccountId, selfCustodialAccountId, commit])

  /** FAILED has no client-side way back: the phase machine only leaves it when a late
   *  payment settles server-side, so offering a retry would loop on a refusal. */
  const serverFailure = hasServerFailed ? MigrationSupportReason.TransferFailed : null

  /** Clears a recoverable record so the commit effect fires again; a commit still in flight
   *  or a failure is left alone. A commit lost to the network may have landed, so after a
   *  connection issue the phase is re-read first: if it advanced past IN_PROGRESS, watch
   *  rather than send a second invoice refused as a state conflict. */
  const runRetry = useCallback(async () => {
    if (!custodialAccountId) return
    const record = commitRecords.get().get(custodialAccountId)
    if (!isRecoverableRecord(record)) return

    if (record.kind === "connectionIssue") {
      let freshStatus: MigrationStatus | null
      try {
        freshStatus = await refetchStatus()
      } catch {
        /** Phase read failed too (still offline): keep the retry, do not recommit blind. */
        return
      }
      /** Another screen's retry may have sent the next commit while the phase was read,
       *  and releasing its record would let a second invoice out behind it. */
      const isRecordUnchanged = commitRecords.get().get(custodialAccountId) === record
      if (!isRecordUnchanged) return
      const hasAdvancedPastCommit =
        freshStatus !== null && freshStatus !== MigrationStatus.InProgress
      if (hasAdvancedPastCommit) {
        recordCommit(custodialAccountId, { kind: "sent" })
        return
      }
    }

    releaseCommit(custodialAccountId)
  }, [custodialAccountId, refetchStatus])

  /** One retry at a time so a double-tap cannot clear the commit guard mid-flight. */
  const isRetryingRef = useRef(false)
  const retry = useCallback(async () => {
    if (isRetryingRef.current) return
    isRetryingRef.current = true
    await runRetry().finally(() => {
      isRetryingRef.current = false
    })
  }, [runRetry])

  /** A recoverable issue and support are mutually exclusive: while the user has a retry, a
   *  server failure on the same render must not also route to support. */
  const activeFailureReason = hasRecoverableIssue ? null : failureReason ?? serverFailure

  return {
    isTransferred,
    isReceiveProven,
    isReceiveDelayed,
    failureReason: activeFailureReason,
    isClockOutOfSync,
    hasConnectionIssue,
    isDepositPending,
    retry,
  }
}
