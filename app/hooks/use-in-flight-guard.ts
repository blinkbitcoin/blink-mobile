import { useState } from "react"

export const InFlightStatus = {
  Ran: "ran",
  AlreadyRunning: "alreadyRunning",
} as const

export type InFlightStatus = (typeof InFlightStatus)[keyof typeof InFlightStatus]

export type InFlightResult<T> =
  | { status: typeof InFlightStatus.Ran; value: T }
  | { status: typeof InFlightStatus.AlreadyRunning }

type InFlightGuard = {
  /** Tells a call turned away apart from an operation that answered `undefined`. */
  attempt: <T>(operation: () => Promise<T>) => Promise<InFlightResult<T>>
  /** For callers that only need the exclusion: `undefined` for a call turned away. */
  run: <T>(operation: () => Promise<T>) => Promise<T | undefined>
  isRunning: () => boolean
  /** Calls `listener` whenever `isRunning()` changes, as `useSyncExternalStore` wants. */
  subscribe: (listener: () => void) => () => void
}

// Created at module scope, the guard holds across every component that uses it, which a
// lock that must survive a screen being left and opened again needs.
export const createInFlightGuard = (): InFlightGuard => {
  let isInFlight = false
  const listeners = new Set<() => void>()

  const setInFlight = (value: boolean) => {
    isInFlight = value
    listeners.forEach((listener) => listener())
  }

  const attempt = async <T>(operation: () => Promise<T>): Promise<InFlightResult<T>> => {
    if (isInFlight) return { status: InFlightStatus.AlreadyRunning }
    try {
      // Inside the try: a listener that throws must not leave the guard held for good.
      setInFlight(true)
      return { status: InFlightStatus.Ran, value: await operation() }
    } finally {
      setInFlight(false)
    }
  }

  const run = async <T>(operation: () => Promise<T>) => {
    const result = await attempt(operation)
    return result.status === InFlightStatus.Ran ? result.value : undefined
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { attempt, run, isRunning: () => isInFlight, subscribe }
}

// The same guard, scoped to one component instance.
export const useInFlightGuard = (): InFlightGuard => {
  const [guard] = useState(createInFlightGuard)
  return guard
}
