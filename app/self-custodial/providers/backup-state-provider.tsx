import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet.types"

const BACKUP_STATE_KEY_PREFIX = "backupState"

const backupStateKeyFor = (accountId: string): string =>
  `${BACKUP_STATE_KEY_PREFIX}:${accountId}`

const BackupStatus = {
  None: "none",
  Pending: "pending",
  Completed: "completed",
} as const

type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus]

const BackupMethod = {
  Cloud: "cloud",
  Keychain: "keychain",
  Manual: "manual",
} as const

type BackupMethod = (typeof BackupMethod)[keyof typeof BackupMethod]

type BackupState = {
  status: BackupStatus
  method: BackupMethod | null
}

type BackupStateContextValue = {
  backupState: BackupState
  setBackupCompleted: (method: BackupMethod) => void
  resetBackupState: () => void
}

const defaultState: BackupState = {
  status: BackupStatus.None,
  method: null,
}

const defaultContextValue: BackupStateContextValue = {
  backupState: defaultState,
  setBackupCompleted: () => {},
  resetBackupState: () => {},
}

const BackupStateContext = createContext<BackupStateContextValue>(defaultContextValue)

const readBackupState = async (key: string): Promise<BackupState | null> => {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.status && Object.values(BackupStatus).includes(parsed.status)) {
      return parsed as BackupState
    }
  } catch {
    // corrupted data; ignore silently
  }
  return null
}

export const removeBackupStateFor = async (accountId: string): Promise<void> => {
  await AsyncStorage.removeItem(backupStateKeyFor(accountId))
}

export const markBackupCompletedFor = async (
  accountId: string,
  method: BackupMethod,
): Promise<void> => {
  const state: BackupState = { status: BackupStatus.Completed, method }
  await AsyncStorage.setItem(backupStateKeyFor(accountId), JSON.stringify(state))
}

export const BackupStateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { activeAccount } = useAccountRegistry()
  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  const [backupState, setBackupState] = useState<BackupState>(defaultState)

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setBackupState(defaultState)
      return
    }

    let mounted = true
    const accountId = activeSelfCustodialAccountId
    const load = async () => {
      const fresh = await readBackupState(backupStateKeyFor(accountId))
      if (!mounted) return
      setBackupState(fresh ?? defaultState)
    }
    load()
    return () => {
      mounted = false
    }
  }, [activeSelfCustodialAccountId])

  const persist = useCallback(
    (state: BackupState) => {
      if (!activeSelfCustodialAccountId) return
      setBackupState(state)
      AsyncStorage.setItem(
        backupStateKeyFor(activeSelfCustodialAccountId),
        JSON.stringify(state),
      ).catch((err) => {
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`Backup state persist failed: ${err}`),
        )
      })
    },
    [activeSelfCustodialAccountId],
  )

  const setBackupCompleted = useCallback(
    (method: BackupMethod) => {
      persist({ status: BackupStatus.Completed, method })
    },
    [persist],
  )

  const resetBackupState = useCallback(() => {
    persist(defaultState)
  }, [persist])

  const value = useMemo(
    (): BackupStateContextValue => ({
      backupState,
      setBackupCompleted,
      resetBackupState,
    }),
    [backupState, setBackupCompleted, resetBackupState],
  )

  return (
    <BackupStateContext.Provider value={value}>{children}</BackupStateContext.Provider>
  )
}

export const useBackupState = (): BackupStateContextValue =>
  useContext(BackupStateContext)

export { BackupStatus, BackupMethod }
export type { BackupState }
