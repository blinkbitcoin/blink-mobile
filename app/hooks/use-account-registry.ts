import { useCallback, useMemo } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  AccountStatus,
  AccountType,
  type AccountDescriptor,
} from "@app/types/wallet.types"

import { useAppConfig } from "./use-app-config"

const CUSTODIAL_DEFAULT_ID = "custodial-default"
const SELF_CUSTODIAL_DEFAULT_ID = "self-custodial-default"

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
      list.push({
        id: CUSTODIAL_DEFAULT_ID,
        type: AccountType.Custodial,
        label: LL.AccountTypeSelectionScreen.custodialLabel(),
        selected: false,
        status: AccountStatus.Available,
      })
    }

    if (nonCustodialEnabled) {
      list.push({
        id: SELF_CUSTODIAL_DEFAULT_ID,
        type: AccountType.SelfCustodial,
        label: LL.AccountTypeSelectionScreen.selfCustodialLabel(),
        selected: false,
        status: AccountStatus.RequiresRestore,
      })
    }

    const activeId = persistentState.activeAccountId
    const resolvedId = activeId ?? list[0]?.id

    return list.map((account) => ({
      ...account,
      selected: account.id === resolvedId,
    }))
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
