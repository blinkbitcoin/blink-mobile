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
 *  unregister/register.
 *
 *  Each lease is settled by its own task and nothing else. A shared settle was the
 *  mechanism behind two ways of lying to the gate: a cycle that landed with one
 *  color resolved a lease that had asked for another, so content mounted and the
 *  guard then came down under it to change color; and a cycle that exhausted its
 *  retries rejected a lease that had joined it, whose own cycle then landed the
 *  guard behind a failure view. A task that finds the guard already registered with
 *  its lease's color resolves at once, so stacked screens still share one native
 *  registration. */
let leaseCount = 0
let registered = false
/** The color the live guard was registered with. `registered` alone cannot tell a
 *  same-tick replace that only changed the theme (release + re-acquire in one
 *  effect pass, so the queued teardown cancels itself) apart from one that changed
 *  nothing — but the former must still re-register, or the native guard keeps the
 *  stale color. */
let registeredColor: string | undefined
let pending: Promise<void> = Promise.resolve()

// A screen whose registration rejected would otherwise stay unprotected for its
// whole lifetime. The cycle retries a bounded number of times; `ready` resolves
// only once one of them lands.
const ENABLE_RETRY_DELAY_MS = 10_000
const ENABLE_RETRY_LIMIT = 3

/** What one acquire asked for, and how to answer it. The cycle checks `released`
 *  rather than the lease count: a lease that is gone has nobody to settle and no
 *  reason to keep registering, while any other live lease has a task of its own. */
type Registration = {
  readonly color: string
  released: boolean
  resolve: () => void
  reject: (error: unknown) => void
}

const enqueue = (task: () => Promise<void>): Promise<void> => {
  // Keep the queue alive even when a native call rejects.
  pending = pending.then(task, task)
  return pending
}

/** A promise with its two settlers handed out beside it, so a registration can
 *  carry them without placeholder functions that nothing ever calls. */
const createSettlement = (): Pick<Registration, "resolve" | "reject"> & {
  ready: Promise<void>
} => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const ready = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { ready, resolve, reject }
}

// The wait between retry attempts, cut short when a lease is released: the cycle's
// own lease gone means the cycle stops, and the last lease gone means a retry must
// not register a guard nobody will unregister. Only one cycle runs at a time, so a
// single handle is enough.
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

const registerWithRetries = async (registration: Registration): Promise<void> => {
  let lastError: unknown = new Error("Screen security registration abandoned")
  // `released` is flipped from outside this loop — a release while a retry sleep is
  // awaited — which is exactly how an abandoned cycle stops early.
  // eslint-disable-next-line no-unmodified-loop-condition
  for (
    let attempt = 0;
    attempt <= ENABLE_RETRY_LIMIT && !registration.released;
    attempt += 1
  ) {
    try {
      await ScreenGuard.initSettings()
      await ScreenGuard.register({ backgroundColor: registration.color })
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
      if (attempt < ENABLE_RETRY_LIMIT && !registration.released)
        await sleepBetweenRetries()
    }
  }
  throw lastError
}

const startRegistration = (registration: Registration): void => {
  // One task per acquire; the queue serializes them. A task that finds the guard
  // already registered with its color makes no native call, which is what lets
  // stacked screens share one registration without sharing each other's outcome.
  enqueue(async () => {
    // Decided at run time, not call time: a teardown queued ahead of this task may
    // have run by now, and a `registered` flag read at call time would be stale
    // exactly when it matters. A lease released before its turn has nobody to
    // settle and makes no native call at all.
    if (registration.released) return
    try {
      if (!registered) {
        await registerWithRetries(registration)
        // Serialized by the queue: no other task can touch `registered` here.
        // eslint-disable-next-line require-atomic-updates
        registered = true
        // eslint-disable-next-line require-atomic-updates
        registeredColor = registration.color
      } else if (registeredColor !== registration.color) {
        // A same-tick replace with a new color (a theme flip re-acquires the lease
        // before the queued teardown runs) cancels the teardown, so without this
        // branch the native guard would keep the stale color. Registering over a
        // live guard cannot be relied on to replace it, so it comes down first.
        try {
          await ScreenGuard.unregister()
        } catch (error) {
          // Reported and carried on, not rethrown: the library's unregister does
          // reject, and letting it escape here would skip the re-registration
          // below and leave the guard down under a lease that is still waiting.
          // The teardown treats the same rejection as recoverable for the same
          // reason.
          reportError("Disable screen security", error)
        } finally {
          // Same reasoning as the teardown below: after a rejected unregister the
          // native state is unknown and `false` is the only recoverable state.
          // eslint-disable-next-line require-atomic-updates
          registered = false
          // eslint-disable-next-line require-atomic-updates
          registeredColor = undefined
        }
        await registerWithRetries(registration)
        // eslint-disable-next-line require-atomic-updates
        registered = true
        // eslint-disable-next-line require-atomic-updates
        registeredColor = registration.color
      }
      if (!registration.released) registration.resolve()
    } catch (error) {
      // A cycle abandoned because its lease was released has nobody to report to;
      // a genuinely exhausted cycle fails the one lease that asked for it.
      if (!registration.released) registration.reject(error)
    }
  })
}

export const acquireScreenSecurity = (backgroundColor: string): ScreenSecurityLease => {
  leaseCount += 1

  const { ready, resolve, reject } = createSettlement()
  const registration: Registration = {
    color: backgroundColor,
    released: false,
    resolve,
    reject,
  }

  startRegistration(registration)

  // Doubles as the idempotency marker: a second release returns the first one's
  // promise rather than deflating the count again.
  let releasePromise: Promise<void> | undefined

  const release = (): Promise<void> => {
    if (releasePromise) return releasePromise
    // A released lease stops waiting: its ready promise never settles, and a cycle
    // running on its behalf stops at its next check.
    registration.released = true
    leaseCount -= 1
    wakeRetry?.()

    if (leaseCount > 0) {
      releasePromise = Promise.resolve()
      return releasePromise
    }

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
        // eslint-disable-next-line require-atomic-updates
        registeredColor = undefined
      }
    })
    return releasePromise
  }

  return { ready, release }
}
