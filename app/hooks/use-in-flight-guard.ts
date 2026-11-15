import { useState } from "react"

type InFlightGuard = {
  run: <T>(operation: () => Promise<T>) => Promise<T | undefined>
  isRunning: () => boolean
}

// `run` returns `undefined` if it is invoked while a previous call is still in flight.
// Created at module scope, the guard holds across every component that uses it, which a
// lock that must survive a screen being left and opened again needs.
export const createInFlightGuard = (): InFlightGuard => {
  let isInFlight = false

  const run = async <T>(operation: () => Promise<T>) => {
    if (isInFlight) return undefined
    isInFlight = true
    try {
      return await operation()
    } finally {
      // eslint-disable-next-line require-atomic-updates
      isInFlight = false
    }
  }

  return { run, isRunning: () => isInFlight }
}

// The same guard, scoped to one component instance.
export const useInFlightGuard = (): InFlightGuard => {
  const [guard] = useState(createInFlightGuard)
  return guard
}
