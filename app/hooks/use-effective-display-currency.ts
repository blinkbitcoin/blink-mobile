import { useCallback } from "react"

import {
  RealtimePriceDocument,
  useAccountUpdateDisplayCurrencyMutation,
  useDisplayCurrencyQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  DEFAULT_DISPLAY_CURRENCY,
  getSelfCustodialDisplayCurrency,
  withSelfCustodialDisplayCurrency,
} from "@app/store/persistent-state/self-custodial-display-currency"
import { AccountType } from "@app/types/wallet.types"

type EffectiveDisplayCurrencyReturn = {
  displayCurrency: string
  setDisplayCurrency: (currency: string) => Promise<void>
  loading: boolean
}

export const useEffectiveDisplayCurrency = (): EffectiveDisplayCurrencyReturn => {
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  const isAuthed = useIsAuthed()
  const { persistentState, updateState } = usePersistentStateContext()

  const { data, loading: queryLoading } = useDisplayCurrencyQuery({
    skip: isSelfCustodial,
    fetchPolicy: isAuthed ? "cache-first" : "cache-only",
  })
  const [updateDisplayCurrencyMutation, { loading: mutationLoading }] =
    useAccountUpdateDisplayCurrencyMutation()

  const setDisplayCurrencySelfCustodial = useCallback(
    async (currency: string) => {
      updateState((prev) => prev && withSelfCustodialDisplayCurrency(prev, currency))
    },
    [updateState],
  )

  const setDisplayCurrencyCustodial = useCallback(
    async (currency: string) => {
      await updateDisplayCurrencyMutation({
        variables: { input: { currency } },
        refetchQueries: [RealtimePriceDocument],
      })
    },
    [updateDisplayCurrencyMutation],
  )

  if (isSelfCustodial) {
    return {
      displayCurrency: getSelfCustodialDisplayCurrency(persistentState),
      setDisplayCurrency: setDisplayCurrencySelfCustodial,
      loading: false,
    }
  }

  return {
    displayCurrency:
      data?.me?.defaultAccount?.displayCurrency ?? DEFAULT_DISPLAY_CURRENCY,
    setDisplayCurrency: setDisplayCurrencyCustodial,
    loading: queryLoading || mutationLoading,
  }
}
