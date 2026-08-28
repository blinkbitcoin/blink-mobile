import ScreenGuard from "react-native-screenguard"

import { reportError } from "@app/utils/error-logging"

export type ScreenSecurityLease = {
  /** Settles with the guard itself: resolves once register has succeeded
   *  (including bounded retries), rejects only once those retries are
   *  exhausted. A lease that has been released never settles — the holder is
   *  gone and late settlement must not reach it. */
  ready: Promise<void>
  /** Idempotent — a retried effect cleanup or a double unmount must not
   *  deflate the count. Releasing the last lease cancels any pending retry
   *  and unregisters; the returned promise settles once that has run. */
  release: () => Promise<void>
}

/** ScreenGuard's register/unregister are global, not per-screen, but protected screens
 *  can stack on each other (backup phrase -> backup confirm, restore phrase step 1 ->
 *  step 2). Count the live leases so one screen's release only unregisters when it is
 *  the last one left; without this, leaving the confirm screen exposed the
 *  still-mounted phrase screen's seed words. The native calls are also serialized:
 *  registration awaits initSettings before register while teardown is a single
 *  unregister, so without a queue the shorter teardown could resolve after the longer
 *  registration and tear down a freshly registered guard.
 *
 *  Registration state is tracked separately from the lease count, and the
 *  register/unregister decisions are made inside the queued task rather than at call
 *  time: a lease acquired while a teardown is in flight re-registers behind it
 *  instead of trusting a `registered` flag that is about to go stale, and a screen
 *  replaced by another protected screen does not churn the guard through
 *  unregister/register. */
let leaseCount = 0
let registered = false
let registering = false
let pending: Promise<void> = Promise.resolve()

// A screen whose registration rejected would otherwise stay unprotected for its
// whole lifetime. The cycle retries a bounded number of times; `ready` resolves
// only once one of them lands.
const ENABLE_RETRY_DELAY_MS = 10_000
const ENABLE_RETRY_LIMIT = 3

type Waiter = {
  resolve: () => void
  reject: (_: unknown) => void
}
let waiters: Waiter[] = []

const enqueue = (task: () => Promise<void>): Promise<void> => {
  // Keep the queue alive even when a native call rejects.
  pending = pending.then(task, task)
  return pending
}

// The wait between retry attempts, cut short when the last lease is released —
// a retry nobody is waiting for must not register a guard nobody will unregister.
let wakeRetry: (() => void) | undefined

const sleepBetweenRetries = (): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeRetry = undefined
      resolve()
    }, ENABLE_RETRY_DELAY_MS)
    wakeRetry = () => {
      clearTimeout(timer)
      wakeRetry = undefined
      resolve()
    }
  })

const settleWaiters = (settle: (waiter: Waiter) => void): void => {
  const settled = waiters
  waiters = []
  for (const waiter of settled) settle(waiter)
}

const registerWithRetries = async (backgroundColor: string): Promise<void> => {
  let lastError: unknown = new Error("Screen security registration abandoned")
  // leaseCount is mutated from outside this loop — acquire/release while a retry
  // sleep is awaited — which is exactly how a cancelled cycle stops early.
  // eslint-disable-next-line no-unmodified-loop-condition
  for (let attempt = 0; attempt <= ENABLE_RETRY_LIMIT && leaseCount > 0; attempt += 1) {
    try {
      await ScreenGuard.initSettings()
      await ScreenGuard.register({ backgroundColor })
      return
    } catch (error) {
      lastError = error
      // Every failed attempt is reported as it happens: waiting for the final
      // rejection (up to RETRY_LIMIT × RETRY_DELAY later) would hide the failure
      // onset from monitoring. The lease holder still reports the exhaustion
      // itself via `ready`.
      reportError(
        attempt === 0 ? "Enable screen security" : "Retry enable screen security",
        error,
      )
      if (attempt < ENABLE_RETRY_LIMIT && leaseCount > 0) await sleepBetweenRetries()
    }
  }
  throw lastError
}

const startRegistration = (backgroundColor: string): void => {
  // A cycle already in flight is shared: concurrent leases just join its waiters.
  if (registering) return
  registering = true
  enqueue(async () => {
    try {
      // Decided at run time, not call time: a teardown queued ahead of this task
      // may have run by now, and a `registered` flag read at call time would be
      // stale exactly when it matters.
      if (!registered) {
        await registerWithRetries(backgroundColor)
        // Serialized by the queue: no other task can touch `registered` here.
        // eslint-disable-next-line require-atomic-updates
        registered = true
      }
      settleWaiters((waiter) => waiter.resolve())
    } catch (error) {
      // A cycle abandoned because the last lease was released has nobody to
      // report to; a genuinely exhausted cycle fails every waiter.
      if (leaseCount > 0) settleWaiters((waiter) => waiter.reject(error))
    } finally {
      // eslint-disable-next-line require-atomic-updates
      registering = false
    }
  })
}

export const acquireScreenSecurity = (backgroundColor: string): ScreenSecurityLease => {
  leaseCount += 1

  const waiter: Waiter = { resolve: () => {}, reject: () => {} }
  const ready = new Promise<void>((resolve, reject) => {
    waiter.resolve = resolve
    waiter.reject = reject
  })
  waiters.push(waiter)

  startRegistration(backgroundColor)

  let released = false
  let releasePromise: Promise<void> | undefined

  const release = (): Promise<void> => {
    if (released) return releasePromise ?? Promise.resolve()
    released = true
    leaseCount -= 1
    // A released lease stops waiting; its ready promise never settles.
    waiters = waiters.filter((current) => current !== waiter)

    if (leaseCount > 0) {
      releasePromise = Promise.resolve()
      return releasePromise
    }

    wakeRetry?.()
    releasePromise = enqueue(async () => {
      if (leaseCount > 0 || !registered) return
      try {
        await ScreenGuard.unregister()
      } finally {
        // A rejected unregister leaves the native state unknown — the shield may
        // or may not have come down — and no later release can reach this task to
        // retry. Leaving `registered` true would wedge the guard: every later
        // acquire would skip the register on the strength of it. `false` is the
        // only recoverable state; the next acquire re-registers, which is
        // harmless if the shield is in fact still on.
        // eslint-disable-next-line require-atomic-updates
        registered = false
      }
    })
    return releasePromise
  }

  return { ready, release }
}
