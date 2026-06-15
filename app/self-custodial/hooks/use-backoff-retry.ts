import { useCallback, useEffect, useRef } from "react"

type BackoffRetry = {
  schedule: (retry: () => void) => void
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
      if (delay === undefined) return
      attemptRef.current += 1

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        retry()
      }, delay)
    },
    [delaysMs],
  )

  useEffect(() => reset, [reset])

  return { schedule, reset }
}
