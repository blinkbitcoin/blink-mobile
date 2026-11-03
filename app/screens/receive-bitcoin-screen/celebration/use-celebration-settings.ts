import { useCallback } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePersistentStateContext } from "@app/store/persistent-state"

type CelebrationSettings = {
  enabled: boolean
  /** The user's own minimum, or the remote-config default while they have none. */
  minSats: number
  setEnabled: (enabled: boolean) => void
  setMinSats: (minSats: number) => void
}

export const useCelebrationSettings = (): CelebrationSettings => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { receiveCelebrationMinSats } = useRemoteConfig()

  const setEnabled = useCallback(
    (enabled: boolean) => {
      updateState((prev) => prev && { ...prev, receiveCelebrationEnabled: enabled })
    },
    [updateState],
  )

  const setMinSats = useCallback(
    (minSats: number) => {
      updateState((prev) => prev && { ...prev, receiveCelebrationMinSats: minSats })
    },
    [updateState],
  )

  return {
    enabled: persistentState.receiveCelebrationEnabled ?? true,
    minSats: persistentState.receiveCelebrationMinSats ?? receiveCelebrationMinSats,
    setEnabled,
    setMinSats,
  }
}
