import { useCallback } from "react"

import { useLanguageQuery, useUserUpdateLanguageMutation } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  DEFAULT_LANGUAGE,
  getSelfCustodialLanguage,
  withSelfCustodialLanguage,
} from "@app/store/persistent-state/self-custodial-language"
import { AccountType } from "@app/types/wallet.types"

type EffectiveLanguageReturn = {
  language: string
  setLanguage: (language: string) => Promise<void>
  loading: boolean
}

export const useEffectiveLanguage = (): EffectiveLanguageReturn => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  const isAuthed = useIsAuthed()
  const { persistentState, updateState } = usePersistentStateContext()

  const { data, loading: queryLoading } = useLanguageQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed || isSelfCustodial,
  })
  const [updateLanguageMutation, { loading: mutationLoading }] =
    useUserUpdateLanguageMutation()

  const setLanguageSelfCustodial = useCallback(
    async (language: string) => {
      updateState((prev) => prev && withSelfCustodialLanguage(prev, language))
    },
    [updateState],
  )

  const setLanguageCustodial = useCallback(
    async (language: string) => {
      await updateLanguageMutation({ variables: { input: { language } } })
    },
    [updateLanguageMutation],
  )

  if (isSelfCustodial) {
    return {
      language: getSelfCustodialLanguage(persistentState),
      setLanguage: setLanguageSelfCustodial,
      loading: false,
    }
  }

  return {
    language: data?.me?.language ?? DEFAULT_LANGUAGE,
    setLanguage: setLanguageCustodial,
    loading: queryLoading || mutationLoading,
  }
}
