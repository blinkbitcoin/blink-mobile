import { renderHook, act } from "@testing-library/react-native"

import {
  createInFlightGuard,
  InFlightStatus,
  useInFlightGuard,
} from "@app/hooks/use-in-flight-guard"

describe("useInFlightGuard", () => {
  it("resolves to the operation's result on first call", async () => {
    const { result } = renderHook(() => useInFlightGuard())

    let value: string | undefined
    await act(async () => {
      value = await result.current.run(async () => "first")
    })

    expect(value).toBe("first")
  })

  it("returns undefined and never invokes the operation when a previous run is still in flight", async () => {
    const { result } = renderHook(() => useInFlightGuard())

    let resolveFirst: () => void
    const firstOp = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = () => resolve("first")
        }),
    )
    const secondOp = jest.fn(async () => "second")

    let firstPromise: Promise<string | undefined> | undefined
    act(() => {
      firstPromise = result.current.run(firstOp)
    })

    let secondResult: string | undefined = "sentinel"
    await act(async () => {
      secondResult = await result.current.run(secondOp)
    })

    expect(secondResult).toBeUndefined()
    expect(secondOp).not.toHaveBeenCalled()
    expect(firstOp).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst!()
      await firstPromise
    })
  })

  it("flips isRunning() during the operation and resets it after resolution", async () => {
    const { result } = renderHook(() => useInFlightGuard())

    let resolveOp: () => void
    const op = () =>
      new Promise<void>((resolve) => {
        resolveOp = resolve
      })

    expect(result.current.isRunning()).toBe(false)

    let runPromise: Promise<void | undefined> | undefined
    act(() => {
      runPromise = result.current.run(op)
    })

    expect(result.current.isRunning()).toBe(true)

    await act(async () => {
      resolveOp!()
      await runPromise
    })

    expect(result.current.isRunning()).toBe(false)
  })

  it("releases the guard on rejection so a follow-up run() can proceed", async () => {
    const { result } = renderHook(() => useInFlightGuard())

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error("boom")
        }),
      ).rejects.toThrow("boom")
    })

    expect(result.current.isRunning()).toBe(false)

    const op = jest.fn(async () => "after")
    let value: string | undefined
    await act(async () => {
      value = await result.current.run(op)
    })

    expect(value).toBe("after")
    expect(op).toHaveBeenCalledTimes(1)
  })

  it("isolates the guard per hook instance (separate hooks do not share state)", async () => {
    const first = renderHook(() => useInFlightGuard())
    const second = renderHook(() => useInFlightGuard())

    let resolveA: () => void
    const opA = () =>
      new Promise<string>((resolve) => {
        resolveA = () => resolve("A")
      })

    let aPromise: Promise<string | undefined> | undefined
    act(() => {
      aPromise = first.result.current.run(opA)
    })

    expect(first.result.current.isRunning()).toBe(true)
    expect(second.result.current.isRunning()).toBe(false)

    let bResult: string | undefined
    await act(async () => {
      bResult = await second.result.current.run(async () => "B")
    })

    expect(bResult).toBe("B")
    expect(first.result.current.isRunning()).toBe(true)

    await act(async () => {
      resolveA!()
      await aPromise
    })

    expect(first.result.current.isRunning()).toBe(false)
  })

  /** `run` answers `undefined` both for a call turned away and for an operation that
   *  answered nothing, so a caller that has to tell them apart asks `attempt`. */
  describe("attempt", () => {
    it("tells an operation that answered nothing from a call turned away", async () => {
      const guard = createInFlightGuard()
      let release: () => void = () => {}
      const first = guard.attempt(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )

      const turnedAway = await guard.attempt(async () => undefined)
      release()

      expect(turnedAway).toEqual({ status: InFlightStatus.AlreadyRunning })
      expect(await first).toEqual({ status: InFlightStatus.Ran, value: undefined })
    })

    it("never runs the operation it turns away", async () => {
      const guard = createInFlightGuard()
      let release: () => void = () => {}
      const first = guard.attempt(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const second = jest.fn(async () => "second")

      await guard.attempt(second)
      release()
      await first

      expect(second).not.toHaveBeenCalled()
    })

    it("passes a rejection through and lets the next attempt run", async () => {
      const guard = createInFlightGuard()

      await expect(
        guard.attempt(async () => {
          throw new Error("boom")
        }),
      ).rejects.toThrow("boom")

      expect(await guard.attempt(async () => "after")).toEqual({
        status: InFlightStatus.Ran,
        value: "after",
      })
    })
  })

  /** A screen mounted while an operation started elsewhere still runs has to see it,
   *  which polling `isRunning()` on render does not give it. */
  describe("subscribe", () => {
    it("tells a listener when an operation starts and when it settles", async () => {
      const guard = createInFlightGuard()
      const seen: boolean[] = []
      guard.subscribe(() => seen.push(guard.isRunning()))
      let release: () => void = () => {}

      const running = guard.run(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      expect(seen).toEqual([true])

      release()
      await running
      expect(seen).toEqual([true, false])
    })

    it("tells it when an operation rejects too", async () => {
      const guard = createInFlightGuard()
      const listener = jest.fn()
      guard.subscribe(listener)

      await guard
        .run(async () => {
          throw new Error("boom")
        })
        .catch(() => undefined)

      expect(listener).toHaveBeenCalledTimes(2)
      expect(guard.isRunning()).toBe(false)
    })

    it("says nothing for a call turned away", async () => {
      const guard = createInFlightGuard()
      let release: () => void = () => {}
      const first = guard.run(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const listener = jest.fn()
      guard.subscribe(listener)

      await guard.run(async () => "second")
      expect(listener).not.toHaveBeenCalled()

      release()
      await first
    })

    it("lets go of the guard even when a listener throws", async () => {
      const guard = createInFlightGuard()
      const unsubscribe = guard.subscribe(() => {
        throw new Error("listener broke")
      })

      await expect(guard.run(async () => "done")).rejects.toThrow("listener broke")
      unsubscribe()

      expect(guard.isRunning()).toBe(false)
      expect(await guard.run(async () => "after")).toBe("after")
    })

    it("stops telling a listener that unsubscribed", async () => {
      const guard = createInFlightGuard()
      const listener = jest.fn()
      const unsubscribe = guard.subscribe(listener)
      unsubscribe()

      await guard.run(async () => "done")

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
