import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getSelfCustodialAccountMode,
  withSelfCustodialAccountMode,
} from "@app/store/persistent-state/self-custodial-account-mode"
import { AccountMode } from "@app/types/account"

type SelfCustodialAccountModeReturn = {
  getAccountMode: (accountId: string) => AccountMode | undefined
  setAccountMode: (accountId: string, mode: AccountMode) => void
}

export const useSelfCustodialAccountMode = (): SelfCustodialAccountModeReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const getAccountMode = useCallback(
    (accountId: string) => getSelfCustodialAccountMode(persistentState, accountId),
    [persistentState],
  )

  const setAccountMode = useCallback(
    (accountId: string, mode: AccountMode) => {
      updateState((prev) => prev && withSelfCustodialAccountMode(prev, accountId, mode))
    },
    [updateState],
  )

  return { getAccountMode, setAccountMode }
}
