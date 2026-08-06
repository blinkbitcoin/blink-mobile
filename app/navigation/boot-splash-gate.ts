/**
 * Coordinates the boot splash with cold-start gates that must resolve before the
 * app is revealed (e.g. the restricted-region verdict). The splash owner awaits
 * `whenReleased` before hiding; a gate driver calls `hold` while its verdict is in
 * flight and `release` when it settles.
 *
 * The gate is monotonic and session-scoped: once released it can never re-engage,
 * so a driver that remounts mid-session (error-boundary reset, account switch)
 * cannot blank an app the user is already looking at. `hold` schedules its own
 * auto-release at `maxHoldMs`, so a driver that crashes or never settles cannot
 * leave the splash up forever.
 */
type BootSplashGate = {
  hold: (maxHoldMs: number) => void
  release: () => void
  whenReleased: () => Promise<void>
}

export const createBootSplashGate = (): BootSplashGate => {
  let isHeld = false
  let isReleased = false
  let resolveRelease: () => void = () => {}
  let releasePromise: Promise<void> | null = null

  const release = () => {
    if (isReleased) return
    isReleased = true
    resolveRelease()
  }

  const hold = (maxHoldMs: number) => {
    if (isHeld || isReleased) return
    isHeld = true
    releasePromise = new Promise((resolve) => {
      resolveRelease = resolve
    })
    setTimeout(release, maxHoldMs)
  }

  const whenReleased = () => {
    if (!isHeld || isReleased) return Promise.resolve()
    return releasePromise as Promise<void>
  }

  return { hold, release, whenReleased }
}

export const bootSplashGate = createBootSplashGate()
