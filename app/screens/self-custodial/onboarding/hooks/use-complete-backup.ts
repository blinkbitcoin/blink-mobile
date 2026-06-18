import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
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
 * Records a finished backup against the account it belongs to and routes onward. During a
 * funded migration it marks the provisioned account and continues to the funds transfer;
 * otherwise it marks the active self-custodial account and lands on success. Shared by every
 * backup method so they behave identically.
 */
export const useCompleteBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { wallets, isSelfCustodial } = useActiveWallet()
  const { backupState, setBackupCompleted } = useBackupState()
  const { checkpoint, accountId: migrationAccountId } = useMigrationCheckpoint()

  const alreadyBackedUp = backupState.status === BackupStatus.Completed
  // Migration only applies on a custodial account; self-custodial backups are standalone.
  const isMigrating = !isSelfCustodial && checkpoint !== null && !alreadyBackedUp
  // Only treat it as a migration once an account has actually been provisioned, so both the
  // mark and the transfer route stay in lockstep (never route to the transfer without one).
  const migratingAccountId = isMigrating ? migrationAccountId : null
  const walletsHaveFunds = hasFunds(wallets)

  return useCallback(
    ({ method, message }: CompleteBackupOptions) => {
      if (migratingAccountId) {
        // The provisioned account is not active yet, so persist directly; the provider picks
        // it up once the session swaps after the transfer.
        markBackupCompletedFor(migratingAccountId, method).catch((err) =>
          reportError("Migration backup state persist", err),
        )
        if (walletsHaveFunds) {
          navigation.navigate("accountMigrationTransferringFunds")
          return
        }
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
    ],
  )
}
