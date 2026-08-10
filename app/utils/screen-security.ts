import ScreenGuard from "react-native-screenguard"

/** ScreenGuard's register/unregister are global, not per-screen, but protected screens
 *  can stack on each other (backup phrase -> backup confirm, restore phrase step 1 ->
 *  step 2). Count the mounted protected screens so one screen's unmount only
 *  unregisters when it is the last one left; without this, leaving the confirm screen
 *  exposed the still-mounted phrase screen's seed words. The native calls are also
 *  serialized: enable awaits initSettings before register while disable is a single
 *  unregister, so without a queue the shorter disable could resolve after the longer
 *  enable and tear down a freshly registered guard. */
let activeScreens = 0
let pending: Promise<void> = Promise.resolve()

const enqueue = (task: () => Promise<void>): Promise<void> => {
  // Keep the queue alive even when a native call rejects.
  pending = pending.then(task, task)
  return pending
}

export const enableScreenSecurity = async (backgroundColor: string): Promise<void> => {
  activeScreens += 1
  if (activeScreens > 1) return
  await enqueue(async () => {
    await ScreenGuard.initSettings()
    await ScreenGuard.register({ backgroundColor })
  })
}

export const disableScreenSecurity = async (): Promise<void> => {
  if (activeScreens === 0) return
  activeScreens -= 1
  if (activeScreens > 0) return
  await enqueue(async () => {
    await ScreenGuard.unregister()
  })
}
