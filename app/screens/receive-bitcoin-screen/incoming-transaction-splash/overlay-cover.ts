import { useEffect } from "react"

let depth = 0
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => listener())
}

/** A modal or sheet is on top. The splash drops rather than covering it. */
export const pushOverlayCover = (): (() => void) => {
  depth += 1
  notify()
  let popped = false
  return () => {
    if (popped) return
    popped = true
    depth = Math.max(0, depth - 1)
    notify()
  }
}

export const isOverlayCovered = (): boolean => depth > 0

export const subscribeOverlayCover = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Holds a cover for as long as `covered` is true. */
export const useOverlayCover = (covered: boolean): void => {
  useEffect(() => {
    if (!covered) return
    return pushOverlayCover()
  }, [covered])
}
