import { useCallback, useEffect, useMemo, useState } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
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
} from "@app/types/wallet.types"
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
  setActiveAccountId: (id: string) => void
  reloadSelfCustodialAccounts: () => Promise<void>
}

export const useAccountRegistry = (): AccountRegistryResult => {
  const isAuthed = useIsAuthed()
  const { nonCustodialEnabled } = useFeatureFlags()
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

  const reloadSelfCustodialAccounts = useCallback(async () => {
    const result = await listSelfCustodialAccounts()
    if (result.status === StorageReadStatus.Ok) {
      setSelfCustodialEntries(result.entries)
    }
  }, [])

  useEffect(() => {
    reloadSelfCustodialAccounts()
  }, [reloadSelfCustodialAccounts, persistentState.activeAccountId])

  useEffect(() => {
    let mounted = true
    KeyStoreWrapper.getSessionProfiles().then((profiles) => {
      if (mounted) setHasStoredCustodialProfile(profiles.length > 0)
    })
    return () => {
      mounted = false
    }
  }, [persistentState.galoyAuthToken, persistentState.activeAccountId])

  const accounts = useMemo(() => {
    const list: AccountDescriptor[] = []

    if (isAuthed || hasStoredCustodialProfile) {
      list.push(createCustodialDescriptor(LL.AccountTypeSelectionScreen.custodialLabel()))
    }

    const fallbackLabel = LL.AccountTypeSelectionScreen.selfCustodialLabel()
    const visibleEntries =
      nonCustodialEnabled || selfCustodialEntries.length > 0 ? selfCustodialEntries : []

    for (const entry of visibleEntries) {
      list.push(
        createSelfCustodialDescriptor(entry.id, entry.lightningAddress ?? fallbackLabel),
      )
    }

    return markSelected(list, persistentState.activeAccountId)
  }, [
    isAuthed,
    hasStoredCustodialProfile,
    nonCustodialEnabled,
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

  return {
    accounts,
    activeAccount,
    selfCustodialEntries,
    setActiveAccountId,
    reloadSelfCustodialAccounts,
  }
}
