import { createContext, useContext } from "react"

import { NetworkError } from "@apollo/client/errors"

type NetworkErrorState = {
  networkError: NetworkError | undefined
  token: string | undefined
  clearNetworkError: () => void
}

const NetworkErrorContext = createContext<NetworkErrorState>({
  networkError: undefined,
  token: undefined,
  clearNetworkError: () => {},
})

export const NetworkErrorContextProvider = NetworkErrorContext.Provider

export const useNetworkError = () => useContext(NetworkErrorContext)
