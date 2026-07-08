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

type CompleteBackupOptions = {
  method: BackupMethod
  message?: string
}

/**
 * Records a finished backup and routes onward, shared by every backup method. A migration
 * continues to the balances overview — the commit point where Approve starts the transfer; a
 * standalone backup marks the active self-custodial account and finishes.
 */
export const useCompleteBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isSelfCustodial } = useActiveWallet()
  const { backupState, setBackupCompleted } = useBackupState()
  const { migrationCheckpoint, migrationAccountId } = useCompleteMigration()

  const alreadyBackedUp = backupState.status === BackupStatus.Completed
  // Migration only applies on a custodial account; self-custodial backups are standalone.
  const isMigrating = !isSelfCustodial && migrationCheckpoint !== null && !alreadyBackedUp
  // Only treat it as a migration once an account has actually been provisioned.
  const migratingAccountId = isMigrating ? migrationAccountId : null

  return useCallback(
    async ({ method, message }: CompleteBackupOptions) => {
      if (migratingAccountId) {
        // Persist the provisioned account's backup before the balance summary, so the swap
        // that follows Approve reads the committed backup state.
        await markBackupCompletedFor(migratingAccountId, method).catch((err) =>
          reportError("Migration backup state persist", err),
        )
        navigation.navigate("accountMigrationBalancesOverview")
        return
      }

      setBackupCompleted(method)
      navigation.navigate("selfCustodialBackupSuccess", {
        reBackup: alreadyBackedUp,
        message,
      })
    },
    [navigation, migratingAccountId, alreadyBackedUp, setBackupCompleted],
  )
}
