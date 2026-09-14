import { useCallback, useEffect, useRef } from "react"

/**
 * Whether the component is still on screen, for work that outlives it: an async handler
 * resolving after a back-press must not navigate onto a screen the user already left.
 * Re-armed on mount rather than only cleared on unmount, so a remount answers true again.
 */
export const useIsMounted = (): (() => boolean) => {
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return useCallback(() => isMountedRef.current, [])
}
