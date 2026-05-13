import { useCallback, useRef, useState } from "react"

import { gql as createGraphqlDocument, useApolloClient } from "@apollo/client"

import {
  buildNwcConnectionUri,
  NwcBudgetInput,
  NwcConnectionCreateError,
  NwcConnectionCreateInput,
} from "../nwc-service"
import {
  DEFAULT_NWC_PERMISSIONS,
  NwcGraphqlPermission,
  toNwcGraphqlPermission,
} from "../nwc-types"
import { generateNwcSecret } from "../nwc-crypto"
import { useNwcConnections } from "./use-nwc-connections"

type CreateNwcConnectionInput = NwcConnectionCreateInput & {
  appName: string
  appPubkey: string
  replaceExisting?: boolean
}

type CreateManualNwcConnectionInput = {
  appName: string
  budgets?: ReadonlyArray<NwcBudgetInput>
  permissions?: ReadonlyArray<NwcGraphqlPermission>
}

type NwcGraphqlError = {
  code?: string | null
  message: string
  path?: ReadonlyArray<string | number> | null
  extensions?: {
    code?: string
  }
}

type NwcConnectionCreateMutationData = {
  nwcConnectionCreate: {
    errors: ReadonlyArray<NwcGraphqlError>
    connectionUri?: string | null
    connection?: {
      id: string
      alias?: string | null
      appPubkey: string
    } | null
  }
}

type NwcServiceInfoQueryData = {
  nwcServiceInfo: {
    serverPubkey: string
    relayUrl: string
  }
}

type ApolloLikeError = {
  message?: string
  graphQLErrors?: ReadonlyArray<NwcGraphqlError>
  networkError?: { message?: string } | null
}

type ApolloResultWithErrors = {
  errors?: ReadonlyArray<NwcGraphqlError>
}

const createNwcGraphqlDocument = (source: string) => createGraphqlDocument(source)

const NWC_CONNECTION_CREATE_MUTATION = createNwcGraphqlDocument(`
  mutation nwcConnectionCreate($input: NwcConnectionCreateInput!) {
    nwcConnectionCreate(input: $input) {
      errors {
        code
        message
        path
      }
      connectionUri
      connection {
        id
        alias
        appPubkey
      }
    }
  }
`)

const NWC_SERVICE_INFO_QUERY = createNwcGraphqlDocument(`
  query NwcServiceInfoForCreate {
    nwcServiceInfo {
      serverPubkey
      relayUrl
    }
  }
`)

const toCreateError = (error: NwcGraphqlError): NwcConnectionCreateError => {
  const message = error.message.toLowerCase()
  const code = error.code ?? error.extensions?.code ?? ""
  const normalizedCode = code.toUpperCase()

  if (
    message.includes("duplicate") ||
    message.includes("already") ||
    normalizedCode.includes("DUPLICATE")
  ) {
    return {
      code: "DUPLICATE_CONNECTION",
      message: error.message,
      replaceable: true,
    }
  }

  if (
    message.includes("unsupported permission") ||
    message.includes("unsupported command") ||
    normalizedCode.includes("UNSUPPORTED")
  ) {
    return {
      code: "UNSUPPORTED_PERMISSIONS",
      message: error.message,
    }
  }

  if (message.includes("relay") || normalizedCode.includes("RELAY")) {
    return {
      code: "RELAY_UNREACHABLE",
      message: error.message,
      retryable: true,
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error.message,
    retryable: true,
  }
}

const createErrorsFromUnknown = (
  error: unknown,
  fallbackMessage = "Unable to create connection",
): ReadonlyArray<NwcConnectionCreateError> => {
  const apolloError = error as ApolloLikeError

  if (apolloError.graphQLErrors?.length) {
    return apolloError.graphQLErrors.map(toCreateError)
  }

  if (apolloError.networkError) {
    return [
      {
        code: "NETWORK_ERROR",
        message: apolloError.networkError.message ?? fallbackMessage,
        retryable: true,
      },
    ]
  }

  return [
    {
      code: "UNKNOWN_ERROR",
      message: apolloError.message ?? fallbackMessage,
      retryable: true,
    },
  ]
}

export const useCreateNwcConnection = () => {
  const { addConnection, getConnectionByAppPubkey, removeConnection } =
    useNwcConnections()
  const client = useApolloClient()
  const inFlightAppPubkeysRef = useRef(new Set<string>())
  const loadingCountRef = useRef(0)
  const [loading, setLoading] = useState(false)

  const startLoading = useCallback(() => {
    loadingCountRef.current += 1
    setLoading(true)
  }, [])

  const stopLoading = useCallback(() => {
    loadingCountRef.current = Math.max(loadingCountRef.current - 1, 0)
    setLoading(loadingCountRef.current > 0)
  }, [])

  const createNwcConnection = useCallback(
    async (input: CreateNwcConnectionInput) => {
      startLoading()
      let trackedInFlight = false

      try {
        const duplicateConnection = getConnectionByAppPubkey(input.appPubkey)

        if (duplicateConnection && !input.replaceExisting) {
          const error: NwcConnectionCreateError = {
            code: "DUPLICATE_CONNECTION",
            message: "Connection already exists",
            replaceable: true,
          }

          return {
            errors: [error],
            connection: undefined,
            connectionUri: undefined,
          }
        }

        if (
          !duplicateConnection &&
          inFlightAppPubkeysRef.current.has(input.appPubkey) &&
          !input.replaceExisting
        ) {
          const error: NwcConnectionCreateError = {
            code: "DUPLICATE_CONNECTION",
            message: "Connection is already being created",
            replaceable: true,
          }

          return {
            errors: [error],
            connection: undefined,
            connectionUri: undefined,
          }
        }

        inFlightAppPubkeysRef.current.add(input.appPubkey)
        trackedInFlight = true

        const createBudgets = input.budgets?.length ? input.budgets : undefined
        const primaryBudget =
          createBudgets?.find((budget) => budget.period === "DAILY") ?? createBudgets?.[0]

        const mutateCreateConnection = (includeBudgets: boolean) =>
          client.mutate<NwcConnectionCreateMutationData>({
            mutation: NWC_CONNECTION_CREATE_MUTATION,
            variables: {
              input: {
                nwcUri: input.nwcUri,
                alias: input.alias,
                permissions: input.permissions,
                ...(includeBudgets && createBudgets ? { budgets: createBudgets } : {}),
              },
            },
            errorPolicy: "all",
          })

        const result = await mutateCreateConnection(true)

        const operationErrors = (result as ApolloResultWithErrors).errors ?? []
        if (operationErrors.length > 0) {
          console.warn("NWC create GraphQL errors", operationErrors)
          return {
            errors: operationErrors.map(toCreateError),
            connection: undefined,
            connectionUri: undefined,
          }
        }

        const payload = result.data?.nwcConnectionCreate
        const payloadErrors = payload?.errors ?? []

        if (payloadErrors.length > 0) {
          console.warn("NWC create payload errors", payloadErrors)
          return {
            errors: payloadErrors.map(toCreateError),
            connection: undefined,
            connectionUri: undefined,
          }
        }

        if (!payload?.connectionUri || !payload.connection) {
          const error: NwcConnectionCreateError = {
            code: "UNKNOWN_ERROR",
            message: "Connection was not created",
          }

          return {
            errors: [error],
            connection: undefined,
            connectionUri: undefined,
          }
        }

        if (duplicateConnection && input.replaceExisting) {
          removeConnection(duplicateConnection.id)
        }

        const connection = addConnection({
          backendId: payload.connection.id,
          appName: payload.connection.alias ?? input.alias ?? input.appName,
          dailyBudgetSats: primaryBudget?.amountSats ?? 0,
          budgetPeriod: primaryBudget?.period,
          budgets: createBudgets ?? [],
          permissions: input.permissions,
          appPubkey: payload.connection.appPubkey ?? input.appPubkey,
        })

        return {
          errors: [],
          connection,
          connectionUri: payload.connectionUri,
        }
      } catch (error) {
        console.warn("NWC create failed", error)

        return {
          errors: createErrorsFromUnknown(error),
          connection: undefined,
          connectionUri: undefined,
        }
      } finally {
        if (trackedInFlight) {
          inFlightAppPubkeysRef.current.delete(input.appPubkey)
        }
        stopLoading()
      }
    },
    [
      addConnection,
      client,
      getConnectionByAppPubkey,
      removeConnection,
      startLoading,
      stopLoading,
    ],
  )

  const createManualNwcConnection = useCallback(
    async ({ appName, budgets = [], permissions }: CreateManualNwcConnectionInput) => {
      startLoading()

      try {
        const result = await client.query<NwcServiceInfoQueryData>({
          query: NWC_SERVICE_INFO_QUERY,
          fetchPolicy: "no-cache",
          errorPolicy: "all",
        })

        const operationErrors = (result as ApolloResultWithErrors).errors ?? []
        if (operationErrors.length > 0) {
          console.warn("NWC service info GraphQL errors", operationErrors)
          return {
            errors: operationErrors.map(toCreateError),
            connection: undefined,
            connectionUri: undefined,
          }
        }

        const { data } = result
        const serviceInfo = data?.nwcServiceInfo
        if (!serviceInfo?.serverPubkey || !serviceInfo.relayUrl) {
          const error: NwcConnectionCreateError = {
            code: "UNKNOWN_ERROR",
            message: "NWC service info is unavailable",
          }

          return {
            errors: [error],
            connection: undefined,
            connectionUri: undefined,
          }
        }

        const nwcUri = buildNwcConnectionUri({
          serverPubkey: serviceInfo.serverPubkey,
          relay: serviceInfo.relayUrl,
          secret: generateNwcSecret(),
        })

        const selectedPermissions =
          permissions ?? DEFAULT_NWC_PERMISSIONS.map(toNwcGraphqlPermission)

        return await createNwcConnection({
          nwcUri,
          alias: appName,
          appName,
          appPubkey: serviceInfo.serverPubkey,
          permissions: selectedPermissions,
          budgets,
        })
      } catch (error) {
        console.warn("NWC service info failed", error)

        return {
          errors: createErrorsFromUnknown(error),
          connection: undefined,
          connectionUri: undefined,
        }
      } finally {
        stopLoading()
      }
    },
    [client, createNwcConnection, startLoading, stopLoading],
  )

  return {
    createNwcConnection,
    createManualNwcConnection,
    loading,
  }
}
