import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { withSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import { AccountMode } from "@app/types/account"

type SelfCustodialAccountModeReturn = {
  setAccountMode: (accountId: string, mode: AccountMode) => void
}

export const useSelfCustodialAccountMode = (): SelfCustodialAccountModeReturn => {
  const { updateState } = usePersistentStateContext()

  const setAccountMode = useCallback(
    (accountId: string, mode: AccountMode) => {
      updateState((prev) => prev && withSelfCustodialAccountMode(prev, accountId, mode))
    },
    [updateState],
  )

  return { setAccountMode }
}
