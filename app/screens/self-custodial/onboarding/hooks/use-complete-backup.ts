import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useCompleteMigration } from "@app/screens/account-migration/hooks"
import {
  BackupMethod,
  BackupStatus,
  markBackupCompletedFor,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import { reportError } from "@app/utils/error-logging"
import { hasFunds } from "@app/utils/has-funds"

type CompleteBackupOptions = {
  method: BackupMethod
  message?: string
}

/**
 * Records a finished backup and routes onward, shared by every backup method. A funded migration
 * continues to the funds transfer; a migration with nothing to transfer completes immediately; a
 * standalone backup marks the active self-custodial account.
 */
export const useCompleteBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { wallets, isSelfCustodial } = useActiveWallet()
  const { backupState, setBackupCompleted } = useBackupState()
  const { migrationCheckpoint, migrationAccountId, completeMigration } =
    useCompleteMigration()

  const alreadyBackedUp = backupState.status === BackupStatus.Completed
  // Migration only applies on a custodial account; self-custodial backups are standalone.
  const isMigrating = !isSelfCustodial && migrationCheckpoint !== null && !alreadyBackedUp
  // Only treat it as a migration once an account has actually been provisioned.
  const migratingAccountId = isMigrating ? migrationAccountId : null
  const walletsHaveFunds = hasFunds(wallets)

  return useCallback(
    async ({ method, message }: CompleteBackupOptions) => {
      if (migratingAccountId) {
        // The provisioned account is not active yet, so mark its backup state directly.
        const persisted = markBackupCompletedFor(migratingAccountId, method).catch(
          (err) => reportError("Migration backup state persist", err),
        )
        if (walletsHaveFunds) {
          navigation.navigate("accountMigrationTransferringFunds")
          return
        }
        // Nothing to transfer: let the backup persist before the swap, then finish the migration.
        await persisted
        await completeMigration()
      } else {
        setBackupCompleted(method)
      }

      navigation.navigate("selfCustodialBackupSuccess", {
        reBackup: alreadyBackedUp,
        message,
      })
    },
    [
      navigation,
      migratingAccountId,
      walletsHaveFunds,
      alreadyBackedUp,
      setBackupCompleted,
      completeMigration,
    ],
  )
}
