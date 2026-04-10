import { useCallback, useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"

const TRUST_MODEL_SEEN_KEY = "trustModelSeen"

export const useTrustModelSeen = () => {
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(TRUST_MODEL_SEEN_KEY).then((val) => {
      setSeen(val === "true")
    })
  }, [])

  const markAsSeen = useCallback(() => {
    setSeen(true)
    AsyncStorage.setItem(TRUST_MODEL_SEEN_KEY, "true")
  }, [])

  return { seen, markAsSeen }
}
