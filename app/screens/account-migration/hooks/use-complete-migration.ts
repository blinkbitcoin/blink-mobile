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
import { MigrationTargetOrigin } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"
import { useSeedMigratedAccountSettings } from "./use-seed-migrated-account-settings"

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

/** Repeated inside the Error because `reportError` forwards only the message. */
const UNPROVEN_RECEIVE_REPORT = "Migration completion without a proven receive"

/** One report per process: the release is an operator decision that holds for the whole
 *  session, so every launch and every retry press would raise the same non-fatal again. */
const UNPROVEN_RECEIVE_DEDUP_KEY = "migration-completion-unproven-receive"

type CompleteMigrationArgs = {
  /** Whether the receive gate saw the payment land, rather than releasing on the notice
   *  window. False skips the close: the funds may still be in the custodial account, and
   *  a deleted account takes them with it. */
  isReceiveProven: boolean
}

type FinishOnDeviceArgs = {
  selfCustodialAccountId: string
  custodialAccountId: string
  /** The outcome rather than a boolean derived from it: a caller cannot invert what it does
   *  not compute. Absent where the close never ran, which leaves the session alive. */
  closeOutcome?: AccountCloseOutcome
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
  const {
    checkpoint,
    accountId,
    expectedReceiveSats,
    sparkInvoice,
    targetOrigin,
    checkpointOwnerId,
    loading,
    saveCheckpoint,
    clearCheckpoint,
  } = useMigrationCheckpointState()
  const { clearPendingAccount } = usePendingMigrationAccounts()
  const { setActiveAccountId, accounts, loading: accountsLoading } = useAccountRegistry()
  const { ownerId: custodialOwnerId } = useCustodialOwnerId()
  const { closeCustodialAccount } = useCloseCustodialAccount()
  const { discardCustodialSession } = useDiscardCustodialSession()
  const { seedMigratedSettings } = useSeedMigratedAccountSettings()

  /** The half of the migration that runs on this device, and the only half left once the
   *  close has had its one attempt: the custodial session goes, the provisioned account
   *  becomes active, and the records that would resume the flow are cleared. */
  const finishOnDevice = useCallback(
    async ({
      selfCustodialAccountId,
      custodialAccountId,
      closeOutcome,
    }: FinishOnDeviceArgs): Promise<void> => {
      /** A closed account took its Kratos identity with it, so the revocation the discard
       *  would fire has nothing left to authenticate with. */
      const isSessionAlive = closeOutcome !== AccountCloseOutcome.Closed
      await discardCustodialSession({ isSessionAlive })
      setActiveAccountId(selfCustodialAccountId)
      await clearCheckpoint()
      await clearPendingAccount(custodialAccountId)
    },
    [discardCustodialSession, setActiveAccountId, clearCheckpoint, clearPendingAccount],
  )

  const runCompletion = useCallback(
    async ({ isReceiveProven }: CompleteMigrationArgs): Promise<MigrationCompletion> => {
      if (!accountId) return MigrationCompletion.AccountMissing
      /** A keychain loss in the resume window would otherwise switch to an account that is
       *  gone, stranding the user with neither. */
      const accountExists = accounts.some((account) => account.id === accountId)
      if (!accountExists) return MigrationCompletion.AccountMissing

      /** Copy the custodial display currency / language / theme onto the migrated account
       *  while its session is still live — the close and the discard below are what make
       *  the server values unreachable. Ahead of the refusal checks, not after them: a
       *  refusal still hands the user their self-custodial wallet, so it needs the
       *  preferences just as much as a clean close does. On this path rather than at
       *  provision time so resumed runs (which never mount the migration screens) are
       *  covered too (#4099). Reported but never rethrown: losing a currency preference
       *  must not strand a user mid-migration, and the account keeps today's defaults if
       *  the copy fails. */
      /** An adopted wallet arrived with settings of its own, chosen for it before this
       *  migration existed. Seeding would overwrite the user's own currency, language and
       *  theme with the custodial account's, which is carry-over turned into loss. */
      const isAdoptedWallet = targetOrigin === MigrationTargetOrigin.Adopted
      if (!isAdoptedWallet) {
        try {
          await seedMigratedSettings(accountId)
        } catch (err) {
          reportError("Migration settings carry-over", err)
        }
      }

      /** The close deletes whatever account the active token authenticates, so it may only
       *  run once this session is proven to be the one that saved the checkpoint. The owner
       *  query has not answered yet here (a launch with no connection), which the next
       *  attempt can still resolve: nothing is spent and nothing is reported, since this is
       *  a waiting state rather than a fault. */
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
        })
        return MigrationCompletion.CloseRefused
      }

      /** The caller released the swap on the notice window rather than a confirmed receive
       *  (the delayed-redirect flag), so where the funds sit is unknown and the deletion
       *  cannot run — an account deleted while they are still in it takes them with it.
       *  Resolved as a refusal because it is terminal in the same way: the user moves on to
       *  the self-custodial wallet and the custodial account, still open, goes to support. */
      if (!isReceiveProven) {
        reportError(
          UNPROVEN_RECEIVE_REPORT,
          new Error(`${UNPROVEN_RECEIVE_REPORT}: account ${custodialOwnerId}`),
          { dedupKey: UNPROVEN_RECEIVE_DEDUP_KEY },
        )
        await finishOnDevice({
          selfCustodialAccountId: accountId,
          custodialAccountId: custodialOwnerId,
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
        closeOutcome,
      })

      /** A refused close still finishes the migration: the funds are already self-custodial,
       *  and holding the user on a dead custodial session would cost them their wallet over
       *  an account only support can now remove. */
      return isAccountClosed
        ? MigrationCompletion.Completed
        : MigrationCompletion.CloseRefused
    },
    [
      accountId,
      accounts,
      custodialOwnerId,
      checkpointOwnerId,
      seedMigratedSettings,
      targetOrigin,
      closeCustodialAccount,
      finishOnDevice,
    ],
  )

  /**
   * Records the invoice the drain was actually requested against, on this screen's one
   * checkpoint instance. It lives here rather than in the transfer hook so there is a
   * single owner read behind it: two no-cache reads of the same id can disagree for a
   * render after an account switch, and an invoice written against the wrong one would be
   * invisible to every other reader.
   *
   * The step is re-saved as it stands, so this adds the invoice without moving where a
   * resume lands. Answers false when the write did not land: without the invoice the gate
   * has nothing to prove the receive with, so the flow takes its delayed-receive path
   * rather than confirming on a weaker signal.
   */
  const recordMigrationSparkInvoice = useCallback(
    async (invoice: string): Promise<boolean> => {
      if (!checkpoint) return false
      return saveCheckpoint(checkpoint, { sparkInvoice: invoice })
    },
    [checkpoint, saveCheckpoint],
  )

  const completeMigration = useCallback(
    (args: CompleteMigrationArgs): Promise<MigrationCompletion> => {
      if (completionInFlight) return completionInFlight

      const attempt = runCompletion(args).finally(() => {
        completionInFlight = null
      })
      completionInFlight = attempt

      return attempt
    },
    [runCompletion],
  )

  /** The account check is only trustworthy once both the checkpoint and the registry have
   *  hydrated: the registry's accounts start empty and fill after an async keystore read. */
  const isMigrationDataLoading = loading || accountsLoading

  /** The account this migration emptied, which is the checkpoint's owner wherever the two
   *  disagree; null only on checkpoints saved before owners existed. */
  const emptiedCustodialAccountId = checkpointOwnerId ?? custodialOwnerId

  return {
    migrationCheckpoint: checkpoint,
    migrationAccountId: accountId,
    /** What the receive gate waits for; null on checkpoints saved before the field existed. */
    migrationExpectedReceiveSats: expectedReceiveSats,
    migrationSparkInvoice: sparkInvoice,
    recordMigrationSparkInvoice,
    /** Read before the discard clears it, so a handover raised after the swap can still
     *  name the custodial account support has to close. */
    custodialAccountId: emptiedCustodialAccountId,
    migrationLoading: isMigrationDataLoading,
    completeMigration,
  }
}
