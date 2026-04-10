import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

const TRUST_MODEL_SEEN_KEY = "trustModelSeen"

export const useTrustModelSeen = () => {
  const [seen, setSeen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(TRUST_MODEL_SEEN_KEY)
      .then((val) => {
        setSeen(val === "true")
      })
      .catch((err) => {
        crashlytics().recordError(
          err instanceof Error ? err : new Error(`Trust model read failed: ${err}`),
        )
      })
      .finally(() => {
        setLoaded(true)
      })
  }, [])

  const markAsSeen = useCallback(() => {
    setSeen(true)
    AsyncStorage.setItem(TRUST_MODEL_SEEN_KEY, "true").catch((err) => {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Trust model write failed: ${err}`),
      )
    })
  }, [])

  return { seen, loaded, markAsSeen }
}
