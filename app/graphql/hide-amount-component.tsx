import * as React from "react"
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react"

import { useHideBalanceQuery } from "@app/graphql/generated"

import { HideAmountContextProvider } from "./hide-amount-context"

export const HideAmountContainer: React.FC<PropsWithChildren> = ({ children }) => {
  const { data: { hideBalance } = { hideBalance: false } } = useHideBalanceQuery()

  // Session-scoped: peeking never writes the persisted hideBalance setting,
  // so "always hide balance" re-hides the amount on the next app start.
  const [hideAmount, setHideAmount] = useState(hideBalance)

  useEffect(() => {
    setHideAmount(hideBalance)
  }, [hideBalance])

  const switchMemoryHideAmount = useCallback(() => {
    setHideAmount((prev) => !prev)
  }, [])

  const contextValue = useMemo(
    () => ({ hideAmount, switchMemoryHideAmount }),
    [hideAmount, switchMemoryHideAmount],
  )

  return (
    <HideAmountContextProvider value={contextValue}>{children}</HideAmountContextProvider>
  )
}
