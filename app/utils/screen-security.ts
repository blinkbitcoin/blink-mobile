import ScreenGuard from "react-native-screenguard"

import { reportError } from "@app/utils/error-logging"

/** ScreenGuard's register/unregister are global, not per-screen, but protected screens
 *  can stack on each other (backup phrase -> backup confirm, restore phrase step 1 ->
 *  step 2). Count the mounted protected screens so one screen's unmount only
 *  unregisters when it is the last one left; without this, leaving the confirm screen
 *  exposed the still-mounted phrase screen's seed words. The native calls are also
 *  serialized: enable awaits initSettings before register while disable is a single
 *  unregister, so without a queue the shorter disable could resolve after the longer
 *  enable and tear down a freshly registered guard.
 *
 *  Registration state is tracked separately from the screen count, and the
 *  register/unregister decisions are made inside the queued task rather than at call
 *  time: a rejected register leaves `registered` false, so the next mounted screen
 *  retries instead of trusting a count that claims protection which was never
 *  installed, and a screen replaced by another protected screen does not churn the
 *  guard through unregister/register. A rejected register also schedules its own
 *  bounded retry — see scheduleEnableRetry — and a rejected unregister resets
 *  `registered` rather than wedging it true — see disableScreenSecurity. */
let activeScreens = 0
let registered = false
let pending: Promise<void> = Promise.resolve()

// A screen whose enable rejected would otherwise stay unprotected for its whole
// lifetime: without a retry here, protection only came back if *another* protected
// screen happened to mount later.
const ENABLE_RETRY_DELAY_MS = 10_000
const ENABLE_RETRY_LIMIT = 3

const enqueue = (task: () => Promise<void>): Promise<void> => {
  // Keep the queue alive even when a native call rejects.
  pending = pending.then(task, task)
  return pending
}

const registerGuard = async (backgroundColor: string): Promise<void> => {
  await ScreenGuard.initSettings()
  await ScreenGuard.register({ backgroundColor })
  // Serialized by the queue: no other task can touch `registered` while this runs.
  // eslint-disable-next-line require-atomic-updates
  registered = true
}

/** Retries run through the same queue and re-check state at fire time, so a retry
 *  landing after the last protected screen unmounted — or after another attempt
 *  already registered — is a no-op rather than a register nobody will unregister.
 *  The task catches its own failures, so a retry chain never rejects the queue. */
const scheduleEnableRetry = (backgroundColor: string, attemptsLeft: number): void => {
  if (attemptsLeft <= 0) return
  setTimeout(() => {
    enqueue(async () => {
      if (registered || activeScreens === 0) return
      try {
        await registerGuard(backgroundColor)
      } catch (error) {
        reportError("Retry enable screen security", error)
        scheduleEnableRetry(backgroundColor, attemptsLeft - 1)
      }
    })
  }, ENABLE_RETRY_DELAY_MS)
}

export const enableScreenSecurity = async (backgroundColor: string): Promise<void> => {
  activeScreens += 1
  await enqueue(async () => {
    if (registered) return
    try {
      await registerGuard(backgroundColor)
    } catch (error) {
      // The caller still sees the rejection (and reports it); the retry is the
      // recovery for the screen that stays mounted.
      scheduleEnableRetry(backgroundColor, ENABLE_RETRY_LIMIT)
      throw error
    }
  })
}

export const disableScreenSecurity = async (): Promise<void> => {
  if (activeScreens === 0) return
  activeScreens -= 1
  await enqueue(async () => {
    if (activeScreens > 0 || !registered) return
    try {
      await ScreenGuard.unregister()
    } finally {
      // A rejected unregister leaves the native state unknown — the shield may or
      // may not have come down — and no later disable can reach this task to retry,
      // since the call-time gate above keeps activeScreens at 0. Leaving
      // `registered` true would wedge the guard: every later enable would skip the
      // register on the strength of it. `false` is the only recoverable state; the
      // next enable re-registers, which is harmless if the shield is in fact on.
      // eslint-disable-next-line require-atomic-updates
      registered = false
    }
  })
}
