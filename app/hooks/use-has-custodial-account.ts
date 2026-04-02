import { useIsAuthed } from "@app/graphql/is-authed-context"

export const useHasCustodialAccount = (): boolean => {
  return useIsAuthed()
}
