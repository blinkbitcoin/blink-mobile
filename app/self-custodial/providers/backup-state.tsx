import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

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
  // Most recent completed method (last-wins); use completedMethods to know
  // everything the user has done.
  method: BackupMethod | null
  completedMethods?: BackupMethod[]
}

// The fallback branch doubles as the migration for records persisted before
// completedMethods existed.
export const completedMethodsOf = (state: BackupState | null): BackupMethod[] =>
  state?.completedMethods ??
  (state?.status === BackupStatus.Completed && state.method ? [state.method] : [])

export const hasCompletedMethod = (
  state: BackupState | null,
  method: BackupMethod,
): boolean => completedMethodsOf(state).includes(method)

// Spreads prev so fields this module doesn't know about survive the write.
const withCompletedMethod = (
  prev: BackupState | null,
  method: BackupMethod,
): BackupState => {
  const methods = completedMethodsOf(prev)
  return {
    ...prev,
    status: BackupStatus.Completed,
    method,
    completedMethods: methods.includes(method) ? methods : [...methods, method],
  }
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
  /** The provider mounts above the app ErrorBoundary, so a rejection from this read has
   *  no net at all; a failed read reports and falls back to the default state. */
  let raw: string | null
  try {
    raw = await AsyncStorage.getItem(key)
  } catch (err) {
    reportError("Backup state read", err)
    return null
  }
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
  const key = backupStateKeyFor(accountId)
  const prev = await readBackupState(key)
  await AsyncStorage.setItem(key, JSON.stringify(withCompletedMethod(prev, method)))
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
    /* istanbul ignore next -- readBackupState catches everything today, so this net is
     * unreachable; it stays because the provider mounts above the app ErrorBoundary and
     * a future refactor that lets load() reject must not become an unhandled rejection */
    load().catch((err) => {
      reportError("Backup state load", err)
    })
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
        reportError("Backup state persist", err)
      })
    },
    [activeSelfCustodialAccountId],
  )

  const setBackupCompleted = useCallback(
    (method: BackupMethod) => {
      persist(withCompletedMethod(backupState, method))
    },
    [persist, backupState],
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
