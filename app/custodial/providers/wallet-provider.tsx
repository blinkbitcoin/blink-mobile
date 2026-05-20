import React, { createContext, useContext, useMemo } from "react"

import { useHomeAuthedQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { mapHomeDataToWalletState } from "../mappers/wallet-state-mapper"

const defaultState: ActiveWalletState = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.Custodial,
}

const CustodialWalletContext = createContext<ActiveWalletState>(defaultState)

export const CustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { data, loading, error } = useHomeAuthedQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  const walletState = useMemo(
    () => mapHomeDataToWalletState(data, { loading, error: Boolean(error), isAuthed }),
    [isAuthed, loading, error, data],
  )

  return (
    <CustodialWalletContext.Provider value={walletState}>
      {children}
    </CustodialWalletContext.Provider>
  )
}

export const useCustodialWallet = (): ActiveWalletState =>
  useContext(CustodialWalletContext)
