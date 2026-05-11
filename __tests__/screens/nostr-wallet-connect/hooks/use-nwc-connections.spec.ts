import { renderHook, act } from "@testing-library/react-native"

import { useNwcConnections } from "@app/screens/nostr-wallet-connect/hooks/use-nwc-connections"

describe("useNwcConnections", () => {
  it("starts with no connections", () => {
    const { result } = renderHook(() => useNwcConnections())

    expect(result.current.connections).toEqual([])
    expect(result.current.hasConnections).toBe(false)
  })

  it("addConnection returns an NwcConnection with correct fields", () => {
    const { result } = renderHook(() => useNwcConnections())

    let connection: ReturnType<typeof result.current.addConnection>

    act(() => {
      connection = result.current.addConnection("Amethyst", 10_000)
    })

    expect(connection!.appName).toBe("Amethyst")
    expect(connection!.dailyBudgetSats).toBe(10_000)
    expect(connection!.id).toBeTruthy()
    expect(connection!.connectionString).toContain("nostr+walletconnect://")
    expect(connection!.createdAt).toBeGreaterThan(0)
  })

  it("addConnection adds the connection to the list", () => {
    const { result } = renderHook(() => useNwcConnections())

    act(() => {
      result.current.addConnection("Amethyst", 10_000)
    })

    expect(result.current.connections).toHaveLength(1)
    expect(result.current.connections[0].appName).toBe("Amethyst")
  })

  it("hasConnections reflects state after adding", () => {
    const { result } = renderHook(() => useNwcConnections())

    expect(result.current.hasConnections).toBe(false)

    act(() => {
      result.current.addConnection("Damus", 1_000)
    })

    expect(result.current.hasConnections).toBe(true)
  })

  it("removeConnection removes a connection by id", () => {
    const { result } = renderHook(() => useNwcConnections())

    let firstId = ""

    jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1000)
    act(() => {
      const conn = result.current.addConnection("Amethyst", 10_000)
      firstId = conn.id
    })

    jest.spyOn(Date, "now").mockReturnValueOnce(2000).mockReturnValueOnce(2000)
    act(() => {
      result.current.addConnection("Damus", 1_000)
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
    const { result } = renderHook(() => useNwcConnections())

    let id: string

    act(() => {
      const conn = result.current.addConnection("Amethyst", 10_000)
      id = conn.id
    })

    expect(result.current.hasConnections).toBe(true)

    act(() => {
      result.current.removeConnection(id!)
    })

    expect(result.current.hasConnections).toBe(false)
  })
})
