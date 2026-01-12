import { useEffect, useRef, useCallback, DependencyList } from "react"

export type DebouncedControl = {
  cancel: () => void
  flush: () => void
  isPending: () => boolean
}

type UseDebouncedEffectOptions = {
  enabled?: boolean
  leading?: boolean
  trailing?: boolean
}

type UseDebouncedEffectArgs = [
  callback: () => void,
  delayMs: number,
  deps: DependencyList,
  options?: UseDebouncedEffectOptions,
]

export const useDebouncedEffect: (...args: UseDebouncedEffectArgs) => DebouncedControl = (
  ...args
) => {
  const [callback, delayMs, deps, options] = args
  const { enabled = true, leading = false, trailing = true } = options ?? {}

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leadingCalledRef = useRef(false)
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      leadingCalledRef.current = false
      return
    }

    if (delayMs <= 0) {
      cbRef.current()
      return
    }

    if (leading && !leadingCalledRef.current) {
      cbRef.current()
      leadingCalledRef.current = true
    }

    if (trailing) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        leadingCalledRef.current = false
        cbRef.current()
      }, delayMs)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs, leading, trailing, ...deps])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    leadingCalledRef.current = false
  }, [])

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      leadingCalledRef.current = false
      cbRef.current()
    }
  }, [])

  const isPending = useCallback(() => Boolean(timeoutRef.current), [])

  return { cancel, flush, isPending }
}
