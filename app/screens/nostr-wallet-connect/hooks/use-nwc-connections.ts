import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
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
  connectionString: string
  sourceNwcUri?: string
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
  connectionString?: string
  sourceNwcUri?: string
  appPubkey?: string
}

type NwcConnectionsContextValue = {
  connections: ReadonlyArray<NwcConnection>
  addConnection: (input: AddNwcConnectionInput) => NwcConnection
  removeConnection: (id: string) => void
  hasConnections: boolean
}

// TODO: replace with the GraphQL-backed adapter when the NWC schema is generated.
const MOCK_CONNECTION_STRING =
  "nostr+walletconnect://a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2?relay=wss%3A%2F%2Frelay.blink.sv&secret=f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5"

let connectionIdSequence = 0

const createConnectionId = (now: number) => {
  connectionIdSequence += 1
  return `${now}-${connectionIdSequence}`
}

const NwcConnectionsContext = createContext<NwcConnectionsContextValue | undefined>(
  undefined,
)

export const NwcConnectionsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [connections, setConnections] = useState<ReadonlyArray<NwcConnection>>([])

  const addConnection = useCallback((input: AddNwcConnectionInput): NwcConnection => {
    const now = Date.now()
    const connection: NwcConnection = {
      id: createConnectionId(now),
      backendId: input.backendId,
      appName: input.appName,
      dailyBudgetSats: input.dailyBudgetSats,
      budgetPeriod: input.budgetPeriod,
      budgets: input.budgets ?? [],
      permissions: input.permissions ?? [],
      connectionString: input.connectionString ?? MOCK_CONNECTION_STRING,
      sourceNwcUri: input.sourceNwcUri,
      appPubkey: input.appPubkey,
      createdAt: now,
    }
    setConnections((prev) => [...prev, connection])
    return connection
  }, [])

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const hasConnections = connections.length > 0

  const value = useMemo(
    () => ({ connections, addConnection, removeConnection, hasConnections }),
    [addConnection, connections, hasConnections, removeConnection],
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
