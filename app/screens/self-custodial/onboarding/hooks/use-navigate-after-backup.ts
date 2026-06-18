import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { hasFunds } from "@app/utils/has-funds"

type NavigateAfterBackupOptions = {
  message?: string
}

/**
 * Routes the user once a backup method completes. During a funded migration the flow
 * continues to the funds transfer (which swaps the session); otherwise it lands on the
 * standard backup success screen. Shared by every backup method so they behave identically.
 */
export const useNavigateAfterBackup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { wallets, isSelfCustodial } = useActiveWallet()
  const { backupState } = useBackupState()
  const { checkpoint } = useMigrationCheckpoint()

  const alreadyBackedUp = backupState.status === BackupStatus.Completed
  // Migration only applies on a custodial account; self-custodial backups are standalone.
  const isMigrating = !isSelfCustodial && checkpoint !== null && !alreadyBackedUp
  const walletsHaveFunds = hasFunds(wallets)

  return useCallback(
    (options?: NavigateAfterBackupOptions) => {
      if (isMigrating && walletsHaveFunds) {
        navigation.navigate("accountMigrationTransferringFunds")
        return
      }
      navigation.navigate("selfCustodialBackupSuccess", {
        reBackup: alreadyBackedUp,
        message: options?.message,
      })
    },
    [navigation, isMigrating, walletsHaveFunds, alreadyBackedUp],
  )
}
