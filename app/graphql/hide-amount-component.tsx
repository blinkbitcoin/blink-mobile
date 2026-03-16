import * as React from "react"
import { PropsWithChildren } from "react"

import { useApolloClient } from "@apollo/client"
import { useHideBalanceQuery } from "@app/graphql/generated"

import { saveHiddenBalanceToolTip, saveHideBalance } from "./client-only-query"
import { HideAmountContextProvider } from "./hide-amount-context"

export const HideAmountContainer: React.FC<PropsWithChildren> = ({ children }) => {
  const client = useApolloClient()
  const { data: { hideBalance: hideAmount } = { hideBalance: false } } =
    useHideBalanceQuery()

  const switchMemoryHideAmount = () => {
    const shouldHideBalance = !hideAmount
    saveHideBalance(client, shouldHideBalance)
    saveHiddenBalanceToolTip(client, shouldHideBalance)
  }

  return (
    <HideAmountContextProvider value={{ hideAmount, switchMemoryHideAmount }}>
      {children}
    </HideAmountContextProvider>
  )
}
