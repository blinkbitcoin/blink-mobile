import * as React from "react"
import { PropsWithChildren, useCallback, useMemo } from "react"

import { useApolloClient } from "@apollo/client"
import { useHideBalanceQuery } from "@app/graphql/generated"

import { saveHiddenBalanceToolTip, saveHideBalance } from "./client-only-query"
import { HideAmountContextProvider } from "./hide-amount-context"

export const HideAmountContainer: React.FC<PropsWithChildren> = ({ children }) => {
  const client = useApolloClient()
  const { data: { hideBalance: hideAmount } = { hideBalance: false } } =
    useHideBalanceQuery()

  const switchMemoryHideAmount = useCallback(() => {
    const shouldHideBalance = !hideAmount
    saveHideBalance(client, shouldHideBalance)
    saveHiddenBalanceToolTip(client, shouldHideBalance)
  }, [client, hideAmount])

  const contextValue = useMemo(
    () => ({ hideAmount, switchMemoryHideAmount }),
    [hideAmount, switchMemoryHideAmount],
  )

  return (
    <HideAmountContextProvider value={contextValue}>{children}</HideAmountContextProvider>
  )
}
