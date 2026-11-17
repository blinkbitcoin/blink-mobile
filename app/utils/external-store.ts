import { useSyncExternalStore } from "react"

/**
 * A value held outside React that components subscribe to, for state that callers
 * outside a component also read synchronously, such as the Apollo links and the SDK
 * config builder.
 *
 * `get` returns the same reference until `set` replaces it, which is what
 * `useSyncExternalStore` needs to avoid re-rendering on every read, and `set` notifies
 * only when the value actually changes.
 */
export type ExternalStore<T> = {
  get: () => T
  set: (next: T) => void
  subscribe: (listener: () => void) => () => void
  /** Test seam: back to the initial value, with every listener dropped. */
  reset: () => void
}

export const createExternalStore = <T>(initial: T): ExternalStore<T> => {
  let value = initial
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reset: () => {
      value = initial
      listeners.clear()
    },
  }
}

/** Subscribes a component to `store`. `read` replaces `get` for a store whose value a
 *  caller must see through a gate, such as a developer switch a release build ignores. */
export const useExternalStore = <T>(
  store: ExternalStore<T>,
  read: () => T = store.get,
): T => useSyncExternalStore(store.subscribe, read, read)
