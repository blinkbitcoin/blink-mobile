import { useCallback, useMemo } from "react"

import {
  NetworkStatus,
  gql as createGraphqlDocument,
  useMutation,
  useQuery,
} from "@apollo/client"

import type { NwcBudgetPeriod, NwcGraphqlPermission } from "../nwc-types"

type NwcTimestamp = Date | number | string | null | undefined

type NwcGraphqlError = {
  code?: string | null
  message: string
  path?: ReadonlyArray<string | number> | null
  extensions?: {
    code?: string
  }
}

type NwcConnectionFields = {
  __typename?: "NwcConnection"
  id: string
  alias?: string | null
  appPubkey: string
  permissions: ReadonlyArray<NwcGraphqlPermission>
  budgets: ReadonlyArray<{
    __typename?: "NwcBudget"
    amountSats: number
    period: NwcBudgetPeriod
    usedSats: number
    remainingSats: number
    resetsAt?: NwcTimestamp
  }>
  revoked: boolean
  expiresAt?: NwcTimestamp
  revokedAt?: NwcTimestamp
  lastUsedAt?: NwcTimestamp
  createdAt: NwcTimestamp
  updatedAt: NwcTimestamp
}

type NwcConnectionsQueryData = {
  nwcConnections: ReadonlyArray<NwcConnectionFields>
}

type NwcConnectionQueryData = {
  nwcConnection?: NwcConnectionFields | null
}

type NwcConnectionRevokeMutationData = {
  nwcConnectionRevoke: {
    errors: ReadonlyArray<NwcGraphqlError>
    success: boolean
    connection?: NwcConnectionFields | null
  }
}

type NwcConnectionsRevokeAllMutationData = {
  nwcConnectionsRevokeAll: {
    errors: ReadonlyArray<NwcGraphqlError>
    revokedCount: number
  }
}

export type NwcManagedBudget = {
  amountSats: number
  period: NwcBudgetPeriod
  usedSats: number
  remainingSats: number
  resetsAt?: number | null
}

export type NwcManagedConnection = {
  id: string
  appName: string
  alias?: string | null
  appPubkey: string
  permissions: ReadonlyArray<NwcGraphqlPermission>
  budgets: ReadonlyArray<NwcManagedBudget>
  revoked: boolean
  expiresAt?: number | null
  revokedAt?: number | null
  lastUsedAt?: number | null
  createdAt: number
  updatedAt: number
}

export type NwcConnectionStatus = "active" | "expired" | "revoked"

export type NwcManagementError = {
  code?: string | null
  message: string
}

const createNwcGraphqlDocument = (source: string) => createGraphqlDocument(source)

const NWC_CONNECTION_FIELDS = `
  __typename
  id
  alias
  appPubkey
  permissions
  budgets {
    __typename
    amountSats
    period
    usedSats
    remainingSats
    resetsAt
  }
  revoked
  expiresAt
  revokedAt
  lastUsedAt
  createdAt
  updatedAt
`

export const NWC_CONNECTIONS_QUERY = createNwcGraphqlDocument(`
  query nwcConnections($includeRevoked: Boolean = false) {
    nwcConnections(includeRevoked: $includeRevoked) {
      ${NWC_CONNECTION_FIELDS}
    }
  }
`)

export const NWC_CONNECTION_QUERY = createNwcGraphqlDocument(`
  query nwcConnection($id: ID!) {
    nwcConnection(id: $id) {
      ${NWC_CONNECTION_FIELDS}
    }
  }
`)

export const NWC_CONNECTION_REVOKE_MUTATION = createNwcGraphqlDocument(`
  mutation nwcConnectionRevoke($input: NwcConnectionRevokeInput!) {
    nwcConnectionRevoke(input: $input) {
      errors {
        code
        message
        path
      }
      success
      connection {
        ${NWC_CONNECTION_FIELDS}
      }
    }
  }
`)

export const NWC_CONNECTIONS_REVOKE_ALL_MUTATION = createNwcGraphqlDocument(`
  mutation nwcConnectionsRevokeAll {
    nwcConnectionsRevokeAll {
      errors {
        code
        message
        path
      }
      revokedCount
    }
  }
`)

const abbreviatePubkey = (pubkey: string) =>
  pubkey.length > 16 ? `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}` : pubkey

const toManagementError = (error: NwcGraphqlError): NwcManagementError => ({
  code: error.code ?? error.extensions?.code,
  message: error.message,
})

export const coerceNwcTimestampToSeconds = (
  timestamp: NwcTimestamp,
): number | undefined => {
  if (timestamp === null || timestamp === undefined) return undefined

  if (timestamp instanceof Date) {
    const time = timestamp.getTime()
    return Number.isFinite(time) ? Math.floor(time / 1000) : undefined
  }

  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim()
    if (!trimmed) return undefined

    const numericTimestamp = Number(trimmed)
    if (Number.isFinite(numericTimestamp)) {
      return coerceNwcTimestampToSeconds(numericTimestamp)
    }

    const parsedTimestamp = Date.parse(trimmed)
    return Number.isFinite(parsedTimestamp)
      ? Math.floor(parsedTimestamp / 1000)
      : undefined
  }

  if (!Number.isFinite(timestamp)) return undefined

  if (timestamp > 1e17) {
    return Math.floor(timestamp / 1_000_000_000)
  }

  if (timestamp > 1e11) {
    return Math.floor(timestamp / 1_000)
  }

  return Math.floor(timestamp)
}

export const toNwcManagedConnection = (
  connection: NwcConnectionFields,
): NwcManagedConnection => ({
  id: connection.id,
  appName: connection.alias?.trim() || abbreviatePubkey(connection.appPubkey),
  alias: connection.alias,
  appPubkey: connection.appPubkey,
  permissions: connection.permissions,
  budgets: connection.budgets.map((budget) => ({
    amountSats: budget.amountSats,
    period: budget.period,
    usedSats: budget.usedSats,
    remainingSats: budget.remainingSats,
    resetsAt: coerceNwcTimestampToSeconds(budget.resetsAt),
  })),
  revoked: connection.revoked,
  expiresAt: coerceNwcTimestampToSeconds(connection.expiresAt),
  revokedAt: coerceNwcTimestampToSeconds(connection.revokedAt),
  lastUsedAt: coerceNwcTimestampToSeconds(connection.lastUsedAt),
  createdAt: coerceNwcTimestampToSeconds(connection.createdAt) ?? 0,
  updatedAt: coerceNwcTimestampToSeconds(connection.updatedAt) ?? 0,
})

export const sortNwcConnectionsByLastUsed = (
  connections: ReadonlyArray<NwcManagedConnection>,
): ReadonlyArray<NwcManagedConnection> =>
  [...connections].sort((a, b) => {
    const aSortTime = a.lastUsedAt ?? a.createdAt
    const bSortTime = b.lastUsedAt ?? b.createdAt

    if (aSortTime !== bSortTime) {
      return bSortTime - aSortTime
    }

    return b.createdAt - a.createdAt
  })

export const getNwcConnectionStatus = (
  connection: Pick<NwcManagedConnection, "expiresAt" | "revoked">,
  nowInSeconds = Math.floor(Date.now() / 1000),
): NwcConnectionStatus => {
  if (connection.revoked) return "revoked"
  if (connection.expiresAt && connection.expiresAt <= nowInSeconds) return "expired"
  return "active"
}

export const useNwcConnectionsQuery = ({
  includeRevoked = false,
  skip = false,
}: {
  includeRevoked?: boolean
  skip?: boolean
} = {}) => {
  const query = useQuery<NwcConnectionsQueryData>(NWC_CONNECTIONS_QUERY, {
    variables: { includeRevoked },
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
    skip,
  })

  const connections = useMemo(
    () =>
      sortNwcConnectionsByLastUsed(
        (query.data?.nwcConnections ?? [])
          .map(toNwcManagedConnection)
          .filter((connection) => includeRevoked || !connection.revoked),
      ),
    [includeRevoked, query.data?.nwcConnections],
  )

  const refresh = useCallback(async () => {
    await query.refetch({ includeRevoked })
  }, [includeRevoked, query])

  return {
    connections,
    connectionCount: connections.length,
    error: query.error,
    loading: query.loading,
    refreshing: query.networkStatus === NetworkStatus.refetch,
    refresh,
  }
}

export const useNwcConnectionQuery = (connectionId: string | undefined) => {
  const query = useQuery<NwcConnectionQueryData>(NWC_CONNECTION_QUERY, {
    variables: { id: connectionId },
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
    notifyOnNetworkStatusChange: true,
    skip: !connectionId,
  })

  const connection = useMemo(
    () =>
      query.data?.nwcConnection
        ? toNwcManagedConnection(query.data.nwcConnection)
        : undefined,
    [query.data?.nwcConnection],
  )

  const refresh = useCallback(async () => {
    if (!connectionId) return
    await query.refetch({ id: connectionId })
  }, [connectionId, query])

  return {
    connection,
    error: query.error,
    loading: query.loading,
    refreshing: query.networkStatus === NetworkStatus.refetch,
    refresh,
  }
}

export const useNwcConnectionRevoke = () => {
  const [mutate, state] = useMutation<NwcConnectionRevokeMutationData>(
    NWC_CONNECTION_REVOKE_MUTATION,
    { errorPolicy: "all" },
  )

  const revokeConnection = useCallback(
    async (connectionId: string) => {
      const result = await mutate({
        variables: { input: { connectionId } },
      })

      const operationErrors = result.errors?.map(toManagementError) ?? []
      const payload = result.data?.nwcConnectionRevoke
      const payloadErrors = payload?.errors.map(toManagementError) ?? []
      const errors = [...operationErrors, ...payloadErrors]

      return {
        errors,
        success: errors.length === 0 && Boolean(payload?.success),
        connection: payload?.connection
          ? toNwcManagedConnection(payload.connection)
          : undefined,
      }
    },
    [mutate],
  )

  return {
    revokeConnection,
    loading: state.loading,
  }
}

export const useNwcConnectionsRevokeAll = () => {
  const [mutate, state] = useMutation<NwcConnectionsRevokeAllMutationData>(
    NWC_CONNECTIONS_REVOKE_ALL_MUTATION,
    { errorPolicy: "all" },
  )

  const revokeAllConnections = useCallback(async () => {
    const result = await mutate()

    const operationErrors = result.errors?.map(toManagementError) ?? []
    const payload = result.data?.nwcConnectionsRevokeAll
    const payloadErrors = payload?.errors.map(toManagementError) ?? []
    const errors = [...operationErrors, ...payloadErrors]

    return {
      errors,
      revokedCount: errors.length === 0 ? payload?.revokedCount ?? 0 : 0,
      success: errors.length === 0,
    }
  }, [mutate])

  return {
    revokeAllConnections,
    loading: state.loading,
  }
}
