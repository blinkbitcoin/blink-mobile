import { useCallback, useState } from "react"

import * as Keychain from "react-native-keychain"

export const useKeychainBackup = (service: string) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const save = useCallback(
    async (value: string): Promise<boolean> => {
      setLoading(true)
      setError(undefined)
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

  return { save, loading, error }
}
