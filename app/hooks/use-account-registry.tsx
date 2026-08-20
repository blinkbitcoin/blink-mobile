import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  listSelfCustodialAccounts,
  StorageReadStatus,
  type SelfCustodialAccountEntry,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  AccountStatus,
  AccountType,
  DefaultAccountId,
  type AccountDescriptor,
} from "@app/types/wallet"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

export const createCustodialDescriptor = (label: string): AccountDescriptor => ({
  id: DefaultAccountId.Custodial,
  type: AccountType.Custodial,
  label,
  selected: false,
  status: AccountStatus.Available,
})

export const createSelfCustodialDescriptor = (
  id: string,
  label: string,
): AccountDescriptor => ({
  id,
  type: AccountType.SelfCustodial,
  label,
  selected: false,
  status: AccountStatus.RequiresRestore,
})

export const markSelected = (
  accounts: AccountDescriptor[],
  activeId: string | undefined,
): AccountDescriptor[] => {
  const resolvedId = activeId ?? accounts[0]?.id
  return accounts.map((account) => ({
    ...account,
    selected: account.id === resolvedId,
  }))
}

type AccountRegistryResult = {
  accounts: AccountDescriptor[]
  activeAccount?: AccountDescriptor
  selfCustodialEntries: SelfCustodialAccountEntry[]
  loading: boolean
  setActiveAccountId: (id: string) => void
  reloadSelfCustodialAccounts: () => Promise<void>
}

/**
 * Exported so tests can supply a settled registry without mounting the
 * provider's device reads — see `__tests__/screens/helper.tsx`. Application
 * code goes through `AccountRegistryProvider` / `useAccountRegistry`.
 */
export const AccountRegistryContext = createContext<AccountRegistryResult | null>(null)

/**
 * Composes the registry value from inputs that have already been resolved.
 *
 * Split out of the provider so "what the registry looks like" is defined once
 * and stays independent of "where the data came from": the provider feeds it
 * the two device reads, while tests feed it seeded entries directly.
 */
export const useComposedAccountRegistry = ({
  selfCustodialEntries,
  hasStoredCustodialProfile,
  loading,
  reloadSelfCustodialAccounts,
}: {
  selfCustodialEntries: SelfCustodialAccountEntry[]
  hasStoredCustodialProfile: boolean
  loading: boolean
  reloadSelfCustodialAccounts: () => Promise<void>
}): AccountRegistryResult => {
  const isAuthed = useIsAuthed()
  const { persistentState, updateState } = usePersistentStateContext()
  const { LL } = useI18nContext()

  const accounts = useMemo(() => {
    const list: AccountDescriptor[] = []

    if (isAuthed || hasStoredCustodialProfile) {
      list.push(createCustodialDescriptor(LL.AccountTypeSelectionScreen.custodialLabel()))
    }

    const fallbackLabel = LL.AccountTypeSelectionScreen.selfCustodialLabel()
    for (const entry of selfCustodialEntries) {
      list.push(
        createSelfCustodialDescriptor(entry.id, entry.lightningAddress ?? fallbackLabel),
      )
    }

    return markSelected(list, persistentState.activeAccountId)
  }, [
    isAuthed,
    hasStoredCustodialProfile,
    selfCustodialEntries,
    persistentState.activeAccountId,
    LL.AccountTypeSelectionScreen,
  ])

  const activeAccount = useMemo(() => accounts.find((a) => a.selected), [accounts])

  const setActiveAccountId = useCallback(
    (id: string) => {
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: id }
      })
    },
    [updateState],
  )

  return useMemo<AccountRegistryResult>(
    () => ({
      accounts,
      activeAccount,
      selfCustodialEntries,
      loading,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
    }),
    [
      accounts,
      activeAccount,
      selfCustodialEntries,
      loading,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
    ],
  )
}

/** Owns the registry so its two device reads run once and are shared via context. */
export const AccountRegistryProvider = ({ children }: { children: ReactNode }) => {
  const isAuthed = useIsAuthed()
  const { persistentState } = usePersistentStateContext()

  const [selfCustodialEntries, setSelfCustodialEntries] = useState<
    SelfCustodialAccountEntry[]
  >(() => {
    // Surface the active self-custodial id on first render to avoid the unauthed flash.
    const id = persistentState.activeAccountId
    if (!id || id === DefaultAccountId.Custodial) return []
    return [{ id, lightningAddress: null }]
  })

  // KeyStore-derived so home agrees with switch-account when the live token has
  // been cleared but a session profile is still saved.
  const [hasStoredCustodialProfile, setHasStoredCustodialProfile] = useState(isAuthed)

  // True until both async reads settle, so callers can wait before trusting `accounts`.
  const [selfCustodialHydrating, setSelfCustodialHydrating] = useState(true)
  const [profilesHydrating, setProfilesHydrating] = useState(true)

  // Consumers can call the reload below at any time, so a read that is still in
  // flight may resolve after a newer one has already answered. Applying it then
  // would clobber fresher entries with stale ones, so late answers are dropped.
  const reloadRequestRef = useRef(0)

  const reloadSelfCustodialAccounts = useCallback(async () => {
    const request = reloadRequestRef.current + 1
    reloadRequestRef.current = request

    setSelfCustodialHydrating(true)
    const result = await listSelfCustodialAccounts()

    if (reloadRequestRef.current !== request) return

    if (result.status === StorageReadStatus.Ok) {
      setSelfCustodialEntries(result.entries)
    }
    setSelfCustodialHydrating(false)
  }, [])

  useEffect(() => {
    reloadSelfCustodialAccounts()
  }, [reloadSelfCustodialAccounts, persistentState.activeAccountId])

  useEffect(() => {
    let mounted = true
    setProfilesHydrating(true)
    KeyStoreWrapper.getSessionProfiles().then((profiles) => {
      if (mounted) {
        setHasStoredCustodialProfile(profiles.length > 0)
        setProfilesHydrating(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [persistentState.galoyAuthToken, persistentState.activeAccountId])

  const value = useComposedAccountRegistry({
    selfCustodialEntries,
    hasStoredCustodialProfile,
    loading: selfCustodialHydrating || profilesHydrating,
    reloadSelfCustodialAccounts,
  })

  return (
    <AccountRegistryContext.Provider value={value}>
      {children}
    </AccountRegistryContext.Provider>
  )
}

export const useAccountRegistry = (): AccountRegistryResult => {
  const context = useContext(AccountRegistryContext)
  if (!context) {
    throw new Error("useAccountRegistry must be used within an AccountRegistryProvider")
  }
  return context
}
