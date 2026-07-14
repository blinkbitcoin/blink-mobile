import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useCompleteMigration } from "@app/screens/account-migration/hooks"
import {
  BackupMethod,
  BackupStatus,
  markBackupCompletedFor,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

type CompleteBackupOptions = {
  method: BackupMethod
  message?: string
}

/**
 * Records a finished backup and routes onward, shared by every backup method. A migration
 * continues to the balances overview (the commit point where Approve starts the transfer); a
 * standalone backup marks the active self-custodial account and finishes.
 */
export const useCompleteBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { isSelfCustodial } = useActiveWallet()
  const { backupState, setBackupCompleted } = useBackupState()
  const { migrationCheckpoint, migrationAccountId } = useCompleteMigration()

  const isAlreadyBackedUp = backupState.status === BackupStatus.Completed
  /** Migration only applies on a custodial account; self-custodial backups are standalone. */
  const isMigrating =
    !isSelfCustodial && migrationCheckpoint !== null && !isAlreadyBackedUp

  return useCallback(
    async ({ method, message }: CompleteBackupOptions) => {
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
         *  swap that follows Approve reads the committed backup state. */
        await markBackupCompletedFor(migrationAccountId, method).catch((err) =>
          reportError("Migration backup state persist", err),
        )
        navigation.navigate("accountMigrationBalancesOverview")
        return
      }

      setBackupCompleted(method)
      navigation.navigate("selfCustodialBackupSuccess", {
        reBackup: isAlreadyBackedUp,
        message,
      })
    },
    [
      navigation,
      isMigrating,
      migrationAccountId,
      isAlreadyBackedUp,
      setBackupCompleted,
      LL,
    ],
  )
}
