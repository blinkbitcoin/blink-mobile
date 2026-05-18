import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { NwcBudgetPeriod, NwcGraphqlPermission } from "../nwc-types"
import type { NwcBudgetInput } from "../nwc-service"

export type NwcConnection = {
  id: string
  backendId?: string
  appName: string
  dailyBudgetSats: number
  budgetPeriod?: NwcBudgetPeriod
  budgets: ReadonlyArray<NwcBudgetInput>
  permissions: ReadonlyArray<NwcGraphqlPermission>
  appPubkey?: string
  createdAt: number
}

export type AddNwcConnectionInput = {
  backendId?: string
  appName: string
  dailyBudgetSats: number
  budgetPeriod?: NwcBudgetPeriod
  budgets?: ReadonlyArray<NwcBudgetInput>
  permissions?: ReadonlyArray<NwcGraphqlPermission>
  appPubkey?: string
}

type NwcConnectionsContextValue = {
  connections: ReadonlyArray<NwcConnection>
  addConnection: (input: AddNwcConnectionInput) => NwcConnection
  removeConnection: (id: string) => void
  getConnectionByAppPubkey: (appPubkey: string) => NwcConnection | undefined
  hasConnections: boolean
}

const createConnectionId = (input: AddNwcConnectionInput, now: number) =>
  input.backendId ?? `${now}-${Math.random().toString(36).slice(2)}`

const NwcConnectionsContext = createContext<NwcConnectionsContextValue | undefined>(
  undefined,
)

export const NwcConnectionsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [connections, setConnections] = useState<ReadonlyArray<NwcConnection>>([])
  const connectionsRef = useRef(connections)

  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])

  const addConnection = useCallback((input: AddNwcConnectionInput): NwcConnection => {
    const now = Date.now()
    const connection: NwcConnection = {
      id: createConnectionId(input, now),
      backendId: input.backendId,
      appName: input.appName,
      dailyBudgetSats: input.dailyBudgetSats,
      budgetPeriod: input.budgetPeriod,
      budgets: input.budgets ?? [],
      permissions: input.permissions ?? [],
      appPubkey: input.appPubkey,
      createdAt: now,
    }
    setConnections((prev) => {
      const next = [...prev, connection]
      connectionsRef.current = next
      return next
    })
    return connection
  }, [])

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c.id !== id)
      connectionsRef.current = next
      return next
    })
  }, [])

  const getConnectionByAppPubkey = useCallback(
    (appPubkey: string) =>
      connectionsRef.current.find((connection) => connection.appPubkey === appPubkey),
    [],
  )

  const hasConnections = connections.length > 0

  const value = useMemo(
    () => ({
      connections,
      addConnection,
      removeConnection,
      getConnectionByAppPubkey,
      hasConnections,
    }),
    [
      addConnection,
      connections,
      getConnectionByAppPubkey,
      hasConnections,
      removeConnection,
    ],
  )

  return React.createElement(NwcConnectionsContext.Provider, { value }, children)
}

export const useNwcConnections = () => {
  const context = useContext(NwcConnectionsContext)
  if (!context) {
    throw new Error("useNwcConnections must be used within NwcConnectionsProvider")
  }

  return context
}
