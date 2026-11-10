import { act, renderHook } from "@testing-library/react-native"

import { createExternalStore, useExternalStore } from "@app/utils/external-store"

describe("createExternalStore", () => {
  it("serves the initial value until it is replaced", () => {
    const store = createExternalStore({ mode: "off" })
    const next = { mode: "on" }

    expect(store.get()).toEqual({ mode: "off" })
    store.set(next)

    expect(store.get()).toBe(next)
  })

  it("notifies subscribers when the value changes", () => {
    const store = createExternalStore("unknown")
    const listener = jest.fn()
    store.subscribe(listener)

    store.set("reachable")

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when the same value is set again", () => {
    const store = createExternalStore("unknown")
    const listener = jest.fn()
    store.subscribe(listener)

    store.set("unknown")

    expect(listener).not.toHaveBeenCalled()
  })

  it("stops notifying a subscriber that unsubscribed", () => {
    const store = createExternalStore("unknown")
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.set("reachable")

    expect(listener).not.toHaveBeenCalled()
  })

  it("goes back to the initial value and drops every subscriber on reset", () => {
    const store = createExternalStore("unknown")
    const listener = jest.fn()
    store.subscribe(listener)
    store.set("reachable")
    listener.mockClear()

    store.reset()
    store.set("unreachable")

    expect(store.get()).toBe("unreachable")
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("useExternalStore", () => {
  it("re-renders with the value the store moves to", () => {
    const store = createExternalStore("unknown")
    const { result } = renderHook(() => useExternalStore(store))

    act(() => store.set("reachable"))

    expect(result.current).toBe("reachable")
  })

  it("reads through the gate it is given", () => {
    const store = createExternalStore("on")
    const { result } = renderHook(() => useExternalStore(store, () => "off"))

    expect(result.current).toBe("off")
  })
})
