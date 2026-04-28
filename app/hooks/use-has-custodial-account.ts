import { usePersistentStateContext } from "@app/store/persistent-state"

export const useHasCustodialAccount = (): boolean => {
  const { persistentState } = usePersistentStateContext()
  return persistentState.galoyAuthToken !== ""
}
