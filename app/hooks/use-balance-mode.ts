import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

export const BalanceMode = {
  Btc: "btc",
  Usd: "usd",
} as const

export type BalanceMode = (typeof BalanceMode)[keyof typeof BalanceMode]

const STORAGE_KEY = "selfCustodialBalanceMode"

const isBalanceMode = (value: string | null): value is BalanceMode =>
  value === BalanceMode.Btc || value === BalanceMode.Usd

type UseBalanceModeResult = {
  mode: BalanceMode
  setMode: (next: BalanceMode) => void
  toggleMode: () => void
  loaded: boolean
}

const persistMode = (next: BalanceMode) => {
  AsyncStorage.setItem(STORAGE_KEY, next).catch((err) => {
    if (err instanceof Error) crashlytics().recordError(err)
  })
}

export const useBalanceMode = (): UseBalanceModeResult => {
  const [mode, setModeState] = useState<BalanceMode>(BalanceMode.Btc)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (isBalanceMode(raw)) setModeState(raw)
      })
      .catch((err) => {
        if (err instanceof Error) crashlytics().recordError(err)
      })
      .finally(() => {
        setLoaded(true)
      })
  }, [])

  const setMode = useCallback((next: BalanceMode) => {
    setModeState(next)
    persistMode(next)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === BalanceMode.Btc ? BalanceMode.Usd : BalanceMode.Btc
      persistMode(next)
      return next
    })
  }, [])

  return { mode, setMode, toggleMode, loaded }
}
