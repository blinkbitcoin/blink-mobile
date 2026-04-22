import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

const STORAGE_KEY = "stableBalanceExplanationShown"

type UseStableBalanceFirstTimeResult = {
  shouldShow: boolean
  markAsShown: () => void
  loaded: boolean
}

export const useStableBalanceFirstTime = (): UseStableBalanceFirstTimeResult => {
  const [shown, setShown] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        setShown(raw === "true")
      })
      .catch((err) => {
        if (err instanceof Error) crashlytics().recordError(err)
      })
      .finally(() => {
        setLoaded(true)
      })
  }, [])

  const markAsShown = useCallback(() => {
    setShown(true)
    AsyncStorage.setItem(STORAGE_KEY, "true").catch((err) => {
      if (err instanceof Error) crashlytics().recordError(err)
    })
  }, [])

  return {
    shouldShow: loaded && !shown,
    markAsShown,
    loaded,
  }
}
