import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

const AccountRegistryContext = createContext<AccountRegistryResult | null>(null)

/**
 * Owns the registry so its two device reads run once and are shared via context.
 *
 * `skipHydration` is a test-only affordance: it skips the two async device
 * reads so the provider settles synchronously on mount. In the jest
 * environment those reads resolve to empty data anyway, but their promises
 * settle after the test body finishes, tripping React's "not wrapped in
 * act(...)" warning in every suite that mounts a screen. Production callers
 * must never pass it.
 */
export const AccountRegistryProvider = ({
  children,
  skipHydration = false,
}: {
  children: ReactNode
  skipHydration?: boolean
}) => {
  const isAuthed = useIsAuthed()
  const { persistentState, updateState } = usePersistentStateContext()
  const { LL } = useI18nContext()

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
  const [selfCustodialHydrating, setSelfCustodialHydrating] = useState(!skipHydration)
  const [profilesHydrating, setProfilesHydrating] = useState(!skipHydration)

  const reloadSelfCustodialAccounts = useCallback(async () => {
    if (skipHydration) return
    setSelfCustodialHydrating(true)
    const result = await listSelfCustodialAccounts()
    if (result.status === StorageReadStatus.Ok) {
      setSelfCustodialEntries(result.entries)
    }
    setSelfCustodialHydrating(false)
  }, [skipHydration])

  useEffect(() => {
    reloadSelfCustodialAccounts()
  }, [reloadSelfCustodialAccounts, persistentState.activeAccountId])

  useEffect(() => {
    if (skipHydration) return undefined
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
  }, [skipHydration, persistentState.galoyAuthToken, persistentState.activeAccountId])

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

  const value = useMemo<AccountRegistryResult>(
    () => ({
      accounts,
      activeAccount,
      selfCustodialEntries,
      loading: selfCustodialHydrating || profilesHydrating,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
    }),
    [
      accounts,
      activeAccount,
      selfCustodialEntries,
      selfCustodialHydrating,
      profilesHydrating,
      setActiveAccountId,
      reloadSelfCustodialAccounts,
    ],
  )

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
