import { useCallback, useRef } from "react"

type InFlightGuard = {
  run: <T>(operation: () => Promise<T>) => Promise<T | undefined>
  isRunning: () => boolean
}

// Returns `undefined` if `run` is invoked while a previous call is still in flight.
export const useInFlightGuard = (): InFlightGuard => {
  const inFlightRef = useRef(false)

  const run = useCallback(async <T>(operation: () => Promise<T>) => {
    if (inFlightRef.current) return undefined
    inFlightRef.current = true
    try {
      return await operation()
    } finally {
      // eslint-disable-next-line require-atomic-updates
      inFlightRef.current = false
    }
  }, [])

  const isRunning = useCallback(() => inFlightRef.current, [])

  return { run, isRunning }
}
