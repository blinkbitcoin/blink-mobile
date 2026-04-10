import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

const BACKUP_STATE_KEY = "backupState"

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

export const BackupStateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [backupState, setBackupState] = useState<BackupState>(defaultState)

  useEffect(() => {
    AsyncStorage.getItem(BACKUP_STATE_KEY).then((raw) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.status && Object.values(BackupStatus).includes(parsed.status)) {
          setBackupState(parsed as BackupState)
        }
      } catch {
        // corrupted data — ignore silently
      }
    })
  }, [])

  const persist = useCallback((state: BackupState) => {
    setBackupState(state)
    AsyncStorage.setItem(BACKUP_STATE_KEY, JSON.stringify(state))
  }, [])

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
