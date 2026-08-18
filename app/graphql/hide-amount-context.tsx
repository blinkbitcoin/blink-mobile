import { createContext, useContext } from "react"

const HideAmountContext = createContext<{
  hideAmount: boolean
  toggleHideAmount: () => void
}>({
  hideAmount: false,
  toggleHideAmount: () => {},
})

export const HideAmountContextProvider = HideAmountContext.Provider

export const useHideAmount = () => useContext(HideAmountContext)
