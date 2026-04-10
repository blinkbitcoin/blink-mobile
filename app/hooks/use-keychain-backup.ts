import { useCallback, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"
import * as Keychain from "react-native-keychain"

export const useKeychainBackup = (service: string) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    async (value: string): Promise<boolean> => {
      setLoading(true)
      setError(null)
      try {
        const result = await Keychain.setGenericPassword(service, value, {
          service,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        })
        return result !== false
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        return false
      } finally {
        setLoading(false)
      }
    },
    [service],
  )

  const read = useCallback(async (): Promise<string | null> => {
    try {
      const credentials = await Keychain.getGenericPassword({ service })
      if (!credentials) return null
      return credentials.password
    } catch (err) {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Keychain read failed: ${err}`),
      )
      return null
    }
  }, [service])

  return { save, read, loading, error }
}
