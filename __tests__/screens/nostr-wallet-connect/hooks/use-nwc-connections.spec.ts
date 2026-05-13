import React, { PropsWithChildren } from "react"
import { renderHook, act } from "@testing-library/react-native"

import {
  NwcConnectionsProvider,
  useNwcConnections,
} from "@app/screens/nostr-wallet-connect/hooks/use-nwc-connections"

const wrapper = ({ children }: PropsWithChildren) =>
  React.createElement(NwcConnectionsProvider, undefined, children)

describe("useNwcConnections", () => {
  it("starts with no connections", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    expect(result.current.connections).toEqual([])
    expect(result.current.hasConnections).toBe(false)
  })

  it("addConnection returns an NwcConnection with correct fields", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    let connection: ReturnType<typeof result.current.addConnection>

    act(() => {
      connection = result.current.addConnection({
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
      })
    })

    expect(connection!.appName).toBe("Amethyst")
    expect(connection!.dailyBudgetSats).toBe(10_000)
    expect(connection!.budgets).toEqual([])
    expect(connection!.permissions).toEqual([])
    expect(connection!.id).toBeTruthy()
    expect(connection!.createdAt).toBeGreaterThan(0)
  })

  it("uses the backend id as the local id when available", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    let connection: ReturnType<typeof result.current.addConnection>

    act(() => {
      connection = result.current.addConnection({
        backendId: "backend-connection-id",
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
      })
    })

    expect(connection!.id).toBe("backend-connection-id")
  })

  it("addConnection adds the connection to the list", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    act(() => {
      result.current.addConnection({ appName: "Amethyst", dailyBudgetSats: 10_000 })
    })

    expect(result.current.connections).toHaveLength(1)
    expect(result.current.connections[0].appName).toBe("Amethyst")
  })

  it("hasConnections reflects state after adding", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    expect(result.current.hasConnections).toBe(false)

    act(() => {
      result.current.addConnection({ appName: "Damus", dailyBudgetSats: 1_000 })
    })

    expect(result.current.hasConnections).toBe(true)
  })

  it("removeConnection removes a connection by id", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    let firstId = ""

    jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1000)
    act(() => {
      const conn = result.current.addConnection({
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
      })
      firstId = conn.id
    })

    jest.spyOn(Date, "now").mockReturnValueOnce(2000).mockReturnValueOnce(2000)
    act(() => {
      result.current.addConnection({ appName: "Damus", dailyBudgetSats: 1_000 })
    })

    expect(result.current.connections).toHaveLength(2)

    act(() => {
      result.current.removeConnection(firstId)
    })

    expect(result.current.connections).toHaveLength(1)
    expect(result.current.connections[0].appName).toBe("Damus")

    jest.restoreAllMocks()
  })

  it("hasConnections becomes false after removing all connections", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    let id: string

    act(() => {
      const conn = result.current.addConnection({
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
      })
      id = conn.id
    })

    expect(result.current.hasConnections).toBe(true)

    act(() => {
      result.current.removeConnection(id!)
    })

    expect(result.current.hasConnections).toBe(false)
  })

  it("shares connection state across hook consumers in the provider", () => {
    const { result } = renderHook(
      () => ({
        first: useNwcConnections(),
        second: useNwcConnections(),
      }),
      { wrapper },
    )

    act(() => {
      result.current.first.addConnection({ appName: "Alby", dailyBudgetSats: 10_000 })
    })

    expect(result.current.second.connections).toHaveLength(1)
    expect(result.current.second.connections[0].appName).toBe("Alby")
  })

  it("generates unique ids for connections created in the same millisecond", () => {
    const { result } = renderHook(() => useNwcConnections(), { wrapper })

    jest.spyOn(Date, "now").mockReturnValue(1000)
    jest.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.2)

    let firstId = ""
    let secondId = ""

    act(() => {
      firstId = result.current.addConnection({
        appName: "Amethyst",
        dailyBudgetSats: 10_000,
      }).id
      secondId = result.current.addConnection({
        appName: "Damus",
        dailyBudgetSats: 1_000,
      }).id
    })

    expect(firstId).not.toBe(secondId)

    jest.restoreAllMocks()
  })
})
