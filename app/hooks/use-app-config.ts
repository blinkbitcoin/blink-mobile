import { useCallback, useMemo } from "react"

import { GaloyInstance, resolveGaloyInstanceOrDefault } from "@app/config"
import {
  useSimulatedOutage,
  withSimulatedGraphqlOutage,
} from "@app/config/simulated-outage"
import { usePersistentStateContext } from "@app/store/persistent-state"

export const useAppConfig = () => {
  const { persistentState, updateState } = usePersistentStateContext()
  /** A no-op outside `__DEV__`, where the store always reads "no outage". */
  const simulatedOutage = useSimulatedOutage()

  const appConfig = useMemo(
    () => ({
      token: persistentState.galoyAuthToken,
      galoyInstance: withSimulatedGraphqlOutage(
        resolveGaloyInstanceOrDefault(persistentState.galoyInstance),
        simulatedOutage.graphql,
      ),
    }),
    [persistentState.galoyAuthToken, persistentState.galoyInstance, simulatedOutage],
  )

  const setGaloyInstance = useCallback(
    (newInstance: GaloyInstance) => {
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyInstance: newInstance,
          }
        return undefined
      })
    },
    [updateState],
  )

  const saveToken = useCallback(
    async (token: string) => {
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyAuthToken: token,
          }
        return undefined
      })
    },
    [updateState],
  )

  const saveTokenAndInstance = useCallback(
    async ({ token, instance }: { token: string; instance: GaloyInstance }) => {
      updateState((state) => {
        if (state)
          return {
            ...state,
            galoyInstance: instance,
            galoyAuthToken: token,
          }
        return undefined
      })
    },
    [updateState],
  )

  return {
    appConfig,
    setGaloyInstance,
    saveToken,
    saveTokenAndInstance,
  }
}
