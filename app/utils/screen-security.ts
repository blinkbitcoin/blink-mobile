import ScreenGuard from "react-native-screenguard"

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
 *  guard through unregister/register. */
let activeScreens = 0
let registered = false
let pending: Promise<void> = Promise.resolve()

const enqueue = (task: () => Promise<void>): Promise<void> => {
  // Keep the queue alive even when a native call rejects.
  pending = pending.then(task, task)
  return pending
}

export const enableScreenSecurity = async (backgroundColor: string): Promise<void> => {
  activeScreens += 1
  await enqueue(async () => {
    if (registered) return
    await ScreenGuard.initSettings()
    await ScreenGuard.register({ backgroundColor })
    // Serialized by the queue: no other task can touch `registered` while this runs.
    // eslint-disable-next-line require-atomic-updates
    registered = true
  })
}

export const disableScreenSecurity = async (): Promise<void> => {
  if (activeScreens === 0) return
  activeScreens -= 1
  await enqueue(async () => {
    if (activeScreens > 0 || !registered) return
    await ScreenGuard.unregister()
    // Serialized by the queue: no other task can touch `registered` while this runs.
    // eslint-disable-next-line require-atomic-updates
    registered = false
  })
}
