import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import {
  MigrationCheckpoint,
  useMigrationCheckpointState,
} from "@app/screens/account-migration/hooks"
import {
  BackupMethod,
  BackupStatus,
  markBackupCompletedFor,
  useBackupState,
  type BackupCompletedOptions,
} from "@app/self-custodial/providers/backup-state"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

type CompleteBackupOptions = {
  method: BackupMethod
  message?: string
  /** Extra state recorded with the completion, e.g. whether a cloud backup
   * carries an extra password (gates the recovery-bundle cloud sync, D9). */
  backupOptions?: BackupCompletedOptions
}

/**
 * Records a finished backup and routes onward, shared by every backup method. A migration
 * continues to the balances overview (the commit point where Approve starts the transfer); a
 * standalone backup marks the active self-custodial account and finishes.
 */
export const useCompleteBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  /** Account type, not useActiveWallet().isSelfCustodial: that also encodes SDK
   *  availability, so it reads false at cold start and right after an account
   *  switch, and a self-custodial user finishing a backup in that window would be
   *  routed as if the account were custodial. */
  const isSelfCustodialAccount = useIsSelfCustodialAccount()
  const { backupState, setBackupCompleted } = useBackupState()
  const {
    checkpoint: migrationCheckpoint,
    accountId: migrationAccountId,
    saveCheckpoint,
  } = useMigrationCheckpointState()

  const isAlreadyBackedUp = backupState.status === BackupStatus.Completed
  /** Migration only applies on a custodial account; self-custodial backups are standalone. */
  const isMigrating =
    !isSelfCustodialAccount && migrationCheckpoint !== null && !isAlreadyBackedUp

  return useCallback(
    async ({ method, message, backupOptions }: CompleteBackupOptions) => {
      if (isMigrating && !migrationAccountId) {
        /** A checkpoint without its provisioned account means the resume state was lost;
         *  a fake standalone success would dead-end the migration silently, so surface
         *  the failure and restart the flow from the explainer. */
        reportError(
          "Migration backup without provisioned account",
          new Error("Checkpoint has no accountId"),
        )
        toastShow({ message: LL.AccountMigration.resumeFailed(), LL })
        navigation.navigate("accountMigrationExplainer")
        return
      }

      if (isMigrating && migrationAccountId) {
        /** Persist the provisioned account's backup before the balance summary, so the
         *  swap that follows Approve reads the committed backup state. A failed write must
         *  stop here, like the checkpoint saves: advancing would later nag the user that a
         *  backup they just completed is missing. The screen stays so a retry re-runs it. */
        const isBackupPersisted = await markBackupCompletedFor(
          migrationAccountId,
          method,
          backupOptions,
        )
          .then(() => true)
          .catch((err) => {
            reportError("Migration backup state persist", err)
            return false
          })
        if (!isBackupPersisted) {
          toastShow({ message: LL.errors.generic(), LL })
          return
        }
        /** Recorded so the stored step matches where the user actually stands, but never
         *  gated on: the mode screen is not a commit point, so a resume routes to the
         *  explainer whether or not this write lands. Blocking would only strand a user who
         *  just finished their backup on a screen with nothing left to do. Reported, though:
         *  a store refusing writes here is the same store the commit point depends on. */
        const { isSaved: isStepRecorded } = await saveCheckpoint(
          MigrationCheckpoint.ChooseExperience,
        )
        if (!isStepRecorded) {
          reportError(
            "Migration choose-experience checkpoint save",
            new Error("Choose-experience step was not persisted"),
          )
        }

        navigation.navigate("selfCustodialChooseExperience", {
          onContinue: {
            route: ChooseExperienceContinueRoute.BalancesOverview,
            accountId: migrationAccountId,
          },
        })
        return
      }

      setBackupCompleted(method, backupOptions)
      navigation.navigate("selfCustodialBackupSuccess", {
        reBackup: isAlreadyBackedUp,
        message,
      })
    },
    [
      navigation,
      isMigrating,
      migrationAccountId,
      saveCheckpoint,
      isAlreadyBackedUp,
      setBackupCompleted,
      LL,
    ],
  )
}
