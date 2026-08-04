import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  BackupMethod,
  completedMethodsOf,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import type { SecuritySignalDescriptor } from "@app/types/security-score"
import { AccountType } from "@app/types/wallet"

export const selfCustodialSecuritySignals = (
  completedMethods: BackupMethod[],
): SecuritySignalDescriptor[] => [
  {
    key: "cloudBackup",
    // Keychain/password-manager backups are off-device automated backups
    // too, so they satisfy this signal.
    done: [BackupMethod.Cloud, BackupMethod.Keychain].some((method) =>
      completedMethods.includes(method),
    ),
    retriggerable: true,
  },
  {
    key: "manualBackup",
    done: completedMethods.includes(BackupMethod.Manual),
    retriggerable: true,
  },
]

/** The self-custodial contribution to the security score; null when not our mode. */
export const useSelfCustodialSecuritySignals = (): SecuritySignalDescriptor[] | null => {
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null

  return selfCustodialSecuritySignals(completedMethodsOf(backupState))
}
