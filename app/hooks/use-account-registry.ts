import { useCallback, useMemo } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  AccountStatus,
  AccountType,
  CUSTODIAL_DEFAULT_ID,
  SELF_CUSTODIAL_DEFAULT_ID,
  type AccountDescriptor,
} from "@app/types/wallet.types"

import { useAppConfig } from "./use-app-config"

export const createCustodialDescriptor = (label: string): AccountDescriptor => ({
  id: CUSTODIAL_DEFAULT_ID,
  type: AccountType.Custodial,
  label,
  selected: false,
  status: AccountStatus.Available,
})

export const createSelfCustodialDescriptor = (label: string): AccountDescriptor => ({
  id: SELF_CUSTODIAL_DEFAULT_ID,
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
  setActiveAccountId: (id: string) => void
}

export const useAccountRegistry = (): AccountRegistryResult => {
  const isAuthed = useIsAuthed()
  const { nonCustodialEnabled } = useFeatureFlags()
  const { persistentState, updateState } = usePersistentStateContext()
  const { saveToken } = useAppConfig()
  const { LL } = useI18nContext()

  const accounts = useMemo(() => {
    const list: AccountDescriptor[] = []

    if (isAuthed) {
      list.push(createCustodialDescriptor(LL.AccountTypeSelectionScreen.custodialLabel()))
    }

    if (nonCustodialEnabled) {
      list.push(
        createSelfCustodialDescriptor(LL.AccountTypeSelectionScreen.selfCustodialLabel()),
      )
    }

    return markSelected(list, persistentState.activeAccountId)
  }, [
    isAuthed,
    nonCustodialEnabled,
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

      const target = accounts.find((a) => a.id === id)
      if (target?.type === AccountType.Custodial) {
        saveToken(persistentState.galoyAuthToken)
      }
    },
    [accounts, updateState, saveToken, persistentState.galoyAuthToken],
  )

  return { accounts, activeAccount, setActiveAccountId }
}
