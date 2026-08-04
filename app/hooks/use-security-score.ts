import { useHideBalanceQuery } from "@app/graphql/generated"
import {
  BackupMethod,
  completedMethodsOf,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

export type SecuritySignalKey = "cloudBackup" | "manualBackup" | "appLock" | "hideBalance"

export type SecuritySignalDescriptor = {
  key: SecuritySignalKey
  done: boolean
  // Backup rows stay tappable after completion so the flow can always be
  // re-run (#3828); toggle-backed rows go inert once done.
  retriggerable: boolean
}

export type SecurityScoreLevel = "low" | "medium" | "high"

export type SecurityScore = {
  signals: SecuritySignalDescriptor[]
  done: number
  total: number
  level: SecurityScoreLevel
}

type SecurityScoreInputs = {
  completedMethods: BackupMethod[]
  isAppLockEnabled: boolean
  isHideBalanceEnabled: boolean
}

type DeviceLockState = {
  isBiometricsEnabled: boolean
  isPinEnabled: boolean
}

export const computeSecurityScore = ({
  completedMethods,
  isAppLockEnabled,
  isHideBalanceEnabled,
}: SecurityScoreInputs): SecurityScore => {
  const signals: SecuritySignalDescriptor[] = [
    {
      key: "cloudBackup",
      // Keychain/password-manager backups are off-device automated backups
      // too, so they satisfy this signal.
      done:
        completedMethods.includes(BackupMethod.Cloud) ||
        completedMethods.includes(BackupMethod.Keychain),
      retriggerable: true,
    },
    {
      key: "manualBackup",
      done: completedMethods.includes(BackupMethod.Manual),
      retriggerable: true,
    },
    { key: "appLock", done: isAppLockEnabled, retriggerable: false },
    { key: "hideBalance", done: isHideBalanceEnabled, retriggerable: false },
  ]

  const done = signals.filter((signal) => signal.done).length
  const ratio = done / signals.length
  const level: SecurityScoreLevel = ratio === 1 ? "high" : ratio < 0.5 ? "low" : "medium"

  return { signals, done, total: signals.length, level }
}

// Device lock comes in as a parameter: the security screen already owns that
// async keystore state and updates it synchronously on toggle, so the score
// reacts instantly and there is a single keystore reader.
export const useSecurityScore = (deviceLock: DeviceLockState): SecurityScore | null => {
  const { activeAccount } = useAccountRegistry()
  const { backupState } = useBackupState()
  const { data: { hideBalance } = { hideBalance: false } } = useHideBalanceQuery()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null

  return computeSecurityScore({
    completedMethods: completedMethodsOf(backupState),
    isAppLockEnabled: deviceLock.isBiometricsEnabled || deviceLock.isPinEnabled,
    isHideBalanceEnabled: hideBalance,
  })
}
