import { useCallback, useState } from "react"

const DEFAULT_BUDGET = 10_000

export const useNewConnection = () => {
  const [appName, setAppName] = useState("")
  const [dailyBudgetSats, setDailyBudgetSats] = useState(DEFAULT_BUDGET)

  const isValid = appName.trim().length > 0

  const selectBudget = useCallback((amount: number) => {
    setDailyBudgetSats(amount)
  }, [])

  return {
    appName,
    setAppName,
    dailyBudgetSats,
    isValid,
    selectBudget,
  }
}
