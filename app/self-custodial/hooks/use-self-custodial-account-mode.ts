import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import {
  getSelfCustodialAccountMode,
  withSelfCustodialAccountMode,
} from "@app/store/persistent-state/self-custodial-account-mode"
import { AccountMode } from "@app/types/account"

type SelfCustodialAccountModeReturn = {
  /** Null when the active account is custodial or has not chosen a mode yet. */
  accountMode: AccountMode | null
  isAnonMode: boolean
  /** The stored mode of a specific account, e.g. one being onboarded while another is active. */
  getModeFor: (accountId: string) => AccountMode | null
  setAccountMode: (accountId: string, mode: AccountMode) => void
  setActiveAccountMode: (mode: AccountMode) => void
}

export const useSelfCustodialAccountMode = (): SelfCustodialAccountModeReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const accountMode = getSelfCustodialAccountMode(persistentState)
  const isAnonMode = accountMode === AccountMode.Anon

  const getModeFor = useCallback(
    (accountId: string) =>
      persistentState.selfCustodialAccountModeByAccountId?.[accountId] ?? null,
    [persistentState.selfCustodialAccountModeByAccountId],
  )

  const setAccountMode = useCallback(
    (accountId: string, mode: AccountMode) => {
      updateState((prev) => prev && withSelfCustodialAccountMode(prev, accountId, mode))
    },
    [updateState],
  )

  const setActiveAccountMode = useCallback(
    (mode: AccountMode) => {
      updateState((prev) => {
        if (!prev) return prev
        const id = resolveActiveSelfCustodialId(prev)
        if (!id) return prev
        return withSelfCustodialAccountMode(prev, id, mode)
      })
    },
    [updateState],
  )

  return { accountMode, isAnonMode, getModeFor, setAccountMode, setActiveAccountMode }
}
