import { useCallback } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { MigrationCompletion } from "@app/types/migration"
import { reportError } from "@app/utils/error-logging"

import {
  AccountCloseOutcome,
  useCloseCustodialAccount,
} from "./use-close-custodial-account"
import { useCustodialOwnerId } from "./use-custodial-owner-id"
import { useDiscardCustodialSession } from "./use-discard-custodial-session"
import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"

/** Module-level, because the callers are separate hook instances with no view of each
 *  other's refs: the resume hook stays mounted in the tab navigator underneath the pushed
 *  migration stack, so it and the transfer screen can both decide to finish at the same
 *  moment, and two runs mean two account deletions and two competing navigation resets.
 *
 *  The second caller waits on the first rather than being turned away: both are watching
 *  the same migration, and answering one of them "unavailable" would raise a retry footer,
 *  or a support handover, over a migration the other just finished. */
let completionInFlight: Promise<MigrationCompletion> | null = null

/** Repeated inside the Error because `reportError` forwards only the message. */
const OWNER_MISMATCH_REPORT = "Migration completion owner mismatch"

/** One report per process: the state is anomalous but stable, so every launch and every
 *  retry press would otherwise raise the same non-fatal again. */
const OWNER_MISMATCH_DEDUP_KEY = "migration-completion-owner-mismatch"

type FinishOnDeviceArgs = {
  selfCustodialAccountId: string
  custodialAccountId: string
  /** False once the account was closed: its Kratos identity is gone, so the revocation the
   *  discard would fire has nothing left to authenticate with. */
  isSessionAlive: boolean
}

/** Closes the emptied custodial account, discards its session, then switches to the
 *  provisioned self-custodial account and clears the checkpoint plus the pending-wallet
 *  record. The order is forced, not preferred: the close authenticates with the custodial
 *  token that the discard destroys, so it is the one step no later launch can retry.
 *
 *  Every outcome either finishes the migration or leaves a retry that can actually succeed.
 *  A state the device can never prove its way out of resolves the same way a server refusal
 *  does, because the alternative is a user holding self-custodial funds behind a button
 *  that will never work. */
export const useCompleteMigration = () => {
  const { checkpoint, accountId, checkpointOwnerId, loading, clearCheckpoint } =
    useMigrationCheckpointState()
  const { clearPendingAccount } = usePendingMigrationAccounts()
  const { setActiveAccountId, accounts, loading: accountsLoading } = useAccountRegistry()
  const { ownerId: custodialOwnerId } = useCustodialOwnerId()
  const { closeCustodialAccount } = useCloseCustodialAccount()
  const { discardCustodialSession } = useDiscardCustodialSession()

  /** The half of the migration that runs on this device, and the only half left once the
   *  close has had its one attempt: the custodial session goes, the provisioned account
   *  becomes active, and the records that would resume the flow are cleared. */
  const finishOnDevice = useCallback(
    async ({
      selfCustodialAccountId,
      custodialAccountId,
      isSessionAlive,
    }: FinishOnDeviceArgs): Promise<void> => {
      await discardCustodialSession({ isSessionAlive })
      setActiveAccountId(selfCustodialAccountId)
      await clearCheckpoint()
      await clearPendingAccount(custodialAccountId)
    },
    [discardCustodialSession, setActiveAccountId, clearCheckpoint, clearPendingAccount],
  )

  const runCompletion = useCallback(async (): Promise<MigrationCompletion> => {
    if (!accountId) return MigrationCompletion.AccountMissing
    /** A keychain loss in the resume window would otherwise switch to an account that is
     *  gone, stranding the user with neither. */
    const accountExists = accounts.some((account) => account.id === accountId)
    if (!accountExists) return MigrationCompletion.AccountMissing

    /** The close deletes whatever account the active token authenticates, so it may only run
     *  once this session is proven to be the one that saved the checkpoint. The owner query
     *  has not answered yet here (a launch with no connection), which the next attempt can
     *  still resolve: nothing is spent and nothing is reported, since this is a waiting
     *  state rather than a fault. */
    if (!custodialOwnerId) return MigrationCompletion.CloseUnavailable

    /** A record written before owners existed is claimed by whoever is active, so the
     *  deletion could aim at a stranger's account and no later attempt makes it provable.
     *  Terminal, therefore, and terminal in the direction that keeps the user moving: the
     *  funds are already self-custodial, so the migration finishes here and the account
     *  itself goes to support, exactly as a server-refused close does. */
    const isCheckpointOwnedByActiveSession = checkpointOwnerId === custodialOwnerId
    if (!isCheckpointOwnedByActiveSession) {
      reportError(
        OWNER_MISMATCH_REPORT,
        new Error(
          `${OWNER_MISMATCH_REPORT}: checkpoint ${
            checkpointOwnerId ?? "unknown"
          }, session ${custodialOwnerId}`,
        ),
        { dedupKey: OWNER_MISMATCH_DEDUP_KEY },
      )
      await finishOnDevice({
        selfCustodialAccountId: accountId,
        custodialAccountId: custodialOwnerId,
        isSessionAlive: true,
      })
      return MigrationCompletion.CloseRefused
    }

    /** Nothing settled, so nothing is spent: leave the session and the checkpoint exactly
     *  as they are and let the caller offer another attempt. */
    const closeOutcome = await closeCustodialAccount(custodialOwnerId)
    if (closeOutcome === AccountCloseOutcome.Retryable)
      return MigrationCompletion.CloseUnavailable

    const isAccountClosed = closeOutcome === AccountCloseOutcome.Closed
    await finishOnDevice({
      selfCustodialAccountId: accountId,
      custodialAccountId: custodialOwnerId,
      isSessionAlive: !isAccountClosed,
    })

    /** A refused close still finishes the migration: the funds are already self-custodial,
     *  and holding the user on a dead custodial session would cost them their wallet over
     *  an account only support can now remove. */
    return isAccountClosed
      ? MigrationCompletion.Completed
      : MigrationCompletion.CloseRefused
  }, [
    accountId,
    accounts,
    custodialOwnerId,
    checkpointOwnerId,
    closeCustodialAccount,
    finishOnDevice,
  ])

  const completeMigration = useCallback((): Promise<MigrationCompletion> => {
    if (completionInFlight) return completionInFlight

    const attempt = runCompletion().finally(() => {
      completionInFlight = null
    })
    completionInFlight = attempt

    return attempt
  }, [runCompletion])

  /** The account check is only trustworthy once both the checkpoint and the registry have
   *  hydrated: the registry's accounts start empty and fill after an async keystore read. */
  const isMigrationDataLoading = loading || accountsLoading

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    /** Read before the discard clears it, so a handover raised after the swap can still name
     *  the custodial account support has to close. */
    custodialAccountId: custodialOwnerId,
    migrationLoading: isMigrationDataLoading,
    completeMigration,
  }
}
