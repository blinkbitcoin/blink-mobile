import { useCallback, useState } from "react"

export type NwcConnection = {
  id: string
  appName: string
  dailyBudgetSats: number
  connectionString: string
  createdAt: number
}

// TODO: remove when backend integration is ready
const MOCK_CONNECTION_STRING =
  "nostr+walletconnect://a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2?relay=wss%3A%2F%2Frelay.blink.sv&secret=f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5"

export const useNwcConnections = () => {
  const [connections, setConnections] = useState<ReadonlyArray<NwcConnection>>([])

  const addConnection = useCallback(
    (appName: string, dailyBudgetSats: number): NwcConnection => {
      const connection: NwcConnection = {
        id: Date.now().toString(),
        appName,
        dailyBudgetSats,
        connectionString: MOCK_CONNECTION_STRING,
        createdAt: Date.now(),
      }
      setConnections((prev) => [...prev, connection])
      return connection
    },
    [],
  )

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const hasConnections = connections.length > 0

  return { connections, addConnection, removeConnection, hasConnections }
}
