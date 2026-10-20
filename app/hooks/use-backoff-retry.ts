import { useCallback, useEffect, useRef } from "react"

type BackoffRetry = {
  /** False once the delays are spent, so a caller can tell a retry that is coming from
   *  one that never will. */
  schedule: (retry: () => void) => boolean
  reset: () => void
}

export const useBackoffRetry = (delaysMs: readonly number[]): BackoffRetry => {
  const attemptRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    attemptRef.current = 0
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const schedule = useCallback(
    (retry: () => void) => {
      const delay = delaysMs[attemptRef.current]
      if (delay === undefined) return false
      attemptRef.current += 1

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        retry()
      }, delay)
      return true
    },
    [delaysMs],
  )

  useEffect(() => reset, [reset])

  return { schedule, reset }
}
