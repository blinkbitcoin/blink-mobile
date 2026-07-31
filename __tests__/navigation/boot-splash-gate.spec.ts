import { createBootSplashGate } from "@app/navigation/boot-splash-gate"

describe("createBootSplashGate", () => {
  it("resolves immediately when the gate was never held", async () => {
    const gate = createBootSplashGate()

    await expect(gate.whenReleased()).resolves.toBeUndefined()
  })

  it("defers whenReleased while held and resolves on release", async () => {
    const gate = createBootSplashGate()
    const onReleased = jest.fn()

    gate.hold(2000)
    const released = gate.whenReleased().then(onReleased)

    await Promise.resolve()
    expect(onReleased).not.toHaveBeenCalled()

    gate.release()
    await released
    expect(onReleased).toHaveBeenCalledTimes(1)
  })

  it("resolves immediately once released", async () => {
    const gate = createBootSplashGate()
    gate.hold(2000)
    gate.release()

    await expect(gate.whenReleased()).resolves.toBeUndefined()
  })

  it("never re-engages after a release", async () => {
    const gate = createBootSplashGate()
    gate.hold(2000)
    gate.release()

    gate.hold(2000)

    await expect(gate.whenReleased()).resolves.toBeUndefined()
  })

  it("auto-releases at the hold cap", async () => {
    jest.useFakeTimers()
    try {
      const gate = createBootSplashGate()
      const onReleased = jest.fn()

      gate.hold(2000)
      const released = gate.whenReleased().then(onReleased)

      jest.advanceTimersByTime(1999)
      await Promise.resolve()
      expect(onReleased).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      await released
      expect(onReleased).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it("ignores a second hold while already held", async () => {
    jest.useFakeTimers()
    try {
      const gate = createBootSplashGate()
      const onReleased = jest.fn()

      gate.hold(1000)
      jest.advanceTimersByTime(500)
      gate.hold(5000)
      const released = gate.whenReleased().then(onReleased)

      jest.advanceTimersByTime(500)
      await released
      expect(onReleased).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it("release is idempotent", () => {
    const gate = createBootSplashGate()
    gate.hold(2000)
    gate.release()

    expect(() => gate.release()).not.toThrow()
  })

  it("a release before any hold keeps the gate permanently open", async () => {
    const gate = createBootSplashGate()

    gate.release()
    gate.hold(2000)

    await expect(gate.whenReleased()).resolves.toBeUndefined()
  })
})
