import { useCallback } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"

type SplashSettings = {
  enabled: boolean
  /** The user's own minimum, or the remote-config default while they have none. */
  minSats: number
  setEnabled: (enabled: boolean) => void
  setMinSats: (minSats: number) => void
}

export const useSplashSettings = (): SplashSettings => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { incomingTransactionSplashMinSats } = useRemoteConfig()

  const setEnabled = useCallback(
    (enabled: boolean) => {
      updateState(
        (prev) => prev && { ...prev, incomingTransactionSplashEnabled: enabled },
      )
    },
    [updateState],
  )

  const setMinSats = useCallback(
    (minSats: number) => {
      updateState(
        (prev) => prev && { ...prev, incomingTransactionSplashMinSats: minSats },
      )
    },
    [updateState],
  )

  return {
    enabled: persistentState.incomingTransactionSplashEnabled ?? true,
    minSats:
      persistentState.incomingTransactionSplashMinSats ??
      incomingTransactionSplashMinSats,
    setEnabled,
    setMinSats,
  }
}
