import { renderHook, act } from "@testing-library/react-native"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"

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
})
