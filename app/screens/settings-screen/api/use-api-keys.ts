import { gql } from "@apollo/client"

import { ApiKeysQuery, Scope, useApiKeysQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { TranslationFunctions } from "@app/i18n/i18n-types"

gql`
  query apiKeys {
    me {
      id
      apiKeys {
        id
        name
        createdAt
        revoked
        expired
        lastUsedAt
        expiresAt
        scopes
        readOnly
      }
    }
  }

  mutation apiKeyCreate($input: ApiKeyCreateInput!) {
    apiKeyCreate(input: $input) {
      apiKey {
        id
        name
        createdAt
        revoked
        expired
        lastUsedAt
        expiresAt
        scopes
        readOnly
      }
      apiKeySecret
    }
  }

  mutation apiKeyRevoke($input: ApiKeyRevokeInput!) {
    apiKeyRevoke(input: $input) {
      apiKey {
        id
        name
        createdAt
        revoked
        expired
        lastUsedAt
        expiresAt
        scopes
        readOnly
      }
    }
  }
`

export type ApiKeyItem = NonNullable<ApiKeysQuery["me"]>["apiKeys"][number]

export type ApiKeyStatus = "active" | "revoked" | "expired"

export const apiKeyStatus = (apiKey: ApiKeyItem): ApiKeyStatus => {
  if (apiKey.revoked) return "revoked"
  if (apiKey.expired) return "expired"
  return "active"
}

export const formatScopes = (
  scopes: readonly Scope[],
  LL: TranslationFunctions,
): string => {
  const labels: Record<Scope, string> = {
    [Scope.Read]: LL.ApiScreen.scopeRead(),
    [Scope.Receive]: LL.ApiScreen.scopeReceive(),
    [Scope.Write]: LL.ApiScreen.scopeWrite(),
  }
  return scopes.map((scope) => labels[scope]).join(", ")
}

export const useApiKeysList = () => {
  const isAuthed = useIsAuthed()
  const { data, loading, error } = useApiKeysQuery({ skip: !isAuthed })

  const apiKeys = [...(data?.me?.apiKeys ?? [])].sort((a, b) => {
    const aActive = apiKeyStatus(a) === "active" ? 0 : 1
    const bActive = apiKeyStatus(b) === "active" ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return Number(b.createdAt) - Number(a.createdAt)
  })

  return { apiKeys, loading, hasError: Boolean(error) }
}
