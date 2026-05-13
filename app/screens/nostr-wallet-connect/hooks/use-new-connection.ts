import { useCallback, useState } from "react"

import { NwcBudgetPeriod, NwcGraphqlPermission } from "../nwc-types"

export const MANUAL_BUDGET_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "NEVER"] as const

const parseBudgetSats = (value: string) => Number(value) || 0

export type ManualBudgetConfig = {
  period: NwcBudgetPeriod
  amountSatsText: string
  enabled: boolean
}

export type ManualConnectionPermissions = {
  receiveOnly: boolean
  readHistory: boolean
  makePayments: boolean
}

const DEFAULT_BUDGET_CONFIGS: ReadonlyArray<ManualBudgetConfig> =
  MANUAL_BUDGET_PERIODS.map((period) => ({
    period,
    amountSatsText: "",
    enabled: false,
  }))

const DEFAULT_PERMISSIONS: ManualConnectionPermissions = {
  receiveOnly: true,
  readHistory: false,
  makePayments: false,
}

export const useNewConnection = () => {
  const [appName, setAppName] = useState("")
  const [budgetConfigs, setBudgetConfigs] =
    useState<ReadonlyArray<ManualBudgetConfig>>(DEFAULT_BUDGET_CONFIGS)
  const [permissionToggles, setPermissionToggles] =
    useState<ManualConnectionPermissions>(DEFAULT_PERMISSIONS)

  const enabledBudgets = budgetConfigs
    .filter((budget) => budget.enabled)
    .map((budget) => ({
      amountSats: parseBudgetSats(budget.amountSatsText),
      period: budget.period,
    }))

  const hasInvalidEnabledBudget = enabledBudgets.some((budget) => budget.amountSats <= 0)

  const permissions: ReadonlyArray<NwcGraphqlPermission> = [
    "GET_INFO",
    ...(permissionToggles.receiveOnly ? (["MAKE_INVOICE"] as const) : []),
    ...(permissionToggles.readHistory
      ? (["GET_BALANCE", "LOOKUP_INVOICE", "LIST_TRANSACTIONS"] as const)
      : []),
    ...(permissionToggles.makePayments ? (["PAY_INVOICE"] as const) : []),
  ]

  const budgetsForCreate = permissionToggles.makePayments ? enabledBudgets : []

  const isValid = appName.trim().length > 0 && !hasInvalidEnabledBudget

  const setBudgetEnabled = useCallback((period: NwcBudgetPeriod, enabled: boolean) => {
    setBudgetConfigs((current) =>
      current.map((budget) =>
        budget.period === period
          ? {
              ...budget,
              enabled,
              amountSatsText:
                enabled && budget.amountSatsText.length === 0
                  ? "10000"
                  : budget.amountSatsText,
            }
          : budget,
      ),
    )
  }, [])

  const setBudgetAmount = useCallback((period: NwcBudgetPeriod, value: string) => {
    setBudgetConfigs((current) =>
      current.map((budget) =>
        budget.period === period
          ? { ...budget, amountSatsText: value.replace(/[^\d]/g, "") }
          : budget,
      ),
    )
  }, [])

  const setPermissionEnabled = useCallback(
    (permission: keyof ManualConnectionPermissions, enabled: boolean) => {
      setPermissionToggles((current) => ({
        ...current,
        [permission]: enabled,
      }))
    },
    [],
  )

  const enabledBudgetCount = enabledBudgets.length

  const firstBudgetForDisplay = enabledBudgets[0]
  const dailyBudgetSats =
    enabledBudgets.find((budget) => budget.period === "DAILY")?.amountSats ??
    firstBudgetForDisplay?.amountSats ??
    0

  const selectedBudgetValue = firstBudgetForDisplay
    ? String(firstBudgetForDisplay.amountSats)
    : "0"

  const customBudgetText = firstBudgetForDisplay
    ? String(firstBudgetForDisplay.amountSats)
    : ""

  const isCustomBudget = enabledBudgetCount > 0

  const selectBudget = useCallback(() => undefined, [])
  const setCustomBudgetSats = useCallback(
    (value: string) => {
      setBudgetAmount("DAILY", value)
      setBudgetEnabled("DAILY", true)
    },
    [setBudgetAmount, setBudgetEnabled],
  )

  return {
    appName,
    setAppName,
    budgetConfigs,
    enabledBudgetCount,
    budgetsForCreate,
    permissions,
    permissionToggles,
    isValid,
    setBudgetEnabled,
    setBudgetAmount,
    setPermissionEnabled,

    // Kept for older UI tests and any callers not yet migrated.
    selectedBudgetValue,
    dailyBudgetSats,
    customBudgetText,
    isCustomBudget,
    selectBudget,
    setCustomBudgetSats,
  }
}
