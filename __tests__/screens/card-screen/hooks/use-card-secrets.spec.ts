import React, { PropsWithChildren } from "react"
import { renderHook, act } from "@testing-library/react-native"

import {
  InMemoryCache,
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  useLazyQuery,
} from "@apollo/client"
import { MockedProvider } from "@apollo/client/testing"
import {
  CardSecretsEncryptedDocument,
  CardSecretsEncryptedQuery,
  CardSecretsEncryptedQueryVariables,
} from "@app/graphql/generated"
import { useCardSecrets } from "@app/screens/card-screen/hooks/use-card-secrets"

type SecretsQueryOptions = LazyQueryHookOptions<
  CardSecretsEncryptedQuery,
  CardSecretsEncryptedQueryVariables
>
type SecretsLazyQueryTuple = LazyQueryResultTuple<
  CardSecretsEncryptedQuery,
  CardSecretsEncryptedQueryVariables
>

const mockFetchEncryptedSecrets = jest.fn()
const mockUseSecretsLazyQuery = jest.fn(
  (_options: SecretsQueryOptions): SecretsLazyQueryTuple | [jest.Mock] => [
    mockFetchEncryptedSecrets,
  ],
)
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardSecretsEncryptedLazyQuery: (options: SecretsQueryOptions) =>
    mockUseSecretsLazyQuery(options),
}))

const mockFetchPublicKey = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-card-encryption", () => ({
  useCardEncryption: () => ({ fetchPublicKey: mockFetchPublicKey, loading: false }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: {} }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/utils/crypto", () => ({
  generateRandomHexKey: () => "abcd1234abcd1234abcd1234abcd1234",
  encryptRsaOaep: () => "encrypted-session-id",
  decryptAesGcm: ({ data }: { data: string }) => {
    if (data === "encrypted-pan-data") return "4242424242424242"
    if (data === "encrypted-cvc-data") return "123"
    return ""
  },
}))

describe("useCardSecrets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSecretsLazyQuery.mockImplementation(() => [mockFetchEncryptedSecrets])
  })

  it("returns initial state with no secrets", () => {
    const { result } = renderHook(() => useCardSecrets())

    expect(result.current.secrets).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(result.current.fetchSecrets).toBeDefined()
  })

  it("fetches and decrypts secrets successfully", async () => {
    mockFetchPublicKey.mockResolvedValue({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })
    mockFetchEncryptedSecrets.mockResolvedValue({
      data: {
        cardSecretsEncrypted: {
          encryptedPan: { iv: "pan-iv", data: "encrypted-pan-data" },
          encryptedCvc: { iv: "cvc-iv", data: "encrypted-cvc-data" },
        },
      },
    })

    const { result } = renderHook(() => useCardSecrets())

    let fetchResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      fetchResult = await result.current.fetchSecrets("card-123")
    })

    expect(fetchResult).toEqual({ pan: "4242424242424242", cvc: "123" })
    expect(result.current.secrets).toEqual({ pan: "4242424242424242", cvc: "123" })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it("returns undefined when public key is not available", async () => {
    mockFetchPublicKey.mockResolvedValue({
      data: { cardEncryptionPublicKey: null },
    })

    const { result } = renderHook(() => useCardSecrets())

    let fetchResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      fetchResult = await result.current.fetchSecrets("card-123")
    })

    expect(fetchResult).toBeUndefined()
    expect(result.current.secrets).toBeUndefined()
  })

  it("returns undefined when encrypted secrets are not available", async () => {
    mockFetchPublicKey.mockResolvedValue({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })
    mockFetchEncryptedSecrets.mockResolvedValue({
      data: { cardSecretsEncrypted: null },
    })

    const { result } = renderHook(() => useCardSecrets())

    let fetchResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      fetchResult = await result.current.fetchSecrets("card-123")
    })

    expect(fetchResult).toBeUndefined()
    expect(result.current.secrets).toBeUndefined()
  })

  it("sets error and shows toast on fetch failure", async () => {
    mockFetchPublicKey.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCardSecrets())

    let fetchResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      fetchResult = await result.current.fetchSecrets("card-123")
    })

    expect(fetchResult).toBeUndefined()
    expect(result.current.error).toBe("Network error")
    expect(result.current.loading).toBe(false)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Network error",
        type: "warning",
      }),
    )
  })

  it("sets empty error message for non-Error throws", async () => {
    mockFetchPublicKey.mockRejectedValue("string error")

    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

    expect(result.current.error).toBe("")
  })

  it("passes cardId and sessionId to encrypted secrets query", async () => {
    mockFetchPublicKey.mockResolvedValue({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })
    mockFetchEncryptedSecrets.mockResolvedValue({
      data: {
        cardSecretsEncrypted: {
          encryptedPan: { iv: "pan-iv", data: "encrypted-pan-data" },
          encryptedCvc: { iv: "cvc-iv", data: "encrypted-cvc-data" },
        },
      },
    })

    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      await result.current.fetchSecrets("card-456")
    })

    expect(mockFetchEncryptedSecrets).toHaveBeenCalledWith({
      variables: { cardId: "card-456", sessionId: "encrypted-session-id" },
    })
  })

  it("keeps the encrypted card number and CVV out of the Apollo cache", async () => {
    const cache = new InMemoryCache()
    const mocks = [
      {
        request: {
          query: CardSecretsEncryptedDocument,
          variables: { cardId: "card-123", sessionId: "encrypted-session-id" },
        },
        result: {
          data: {
            cardSecretsEncrypted: {
              __typename: "CardSecretsEncrypted",
              encryptedPan: {
                __typename: "EncryptedData",
                iv: "pan-iv",
                data: "encrypted-pan-data",
              },
              encryptedCvc: {
                __typename: "EncryptedData",
                iv: "cvc-iv",
                data: "encrypted-cvc-data",
              },
            },
          },
        },
      },
    ]
    const wrapper = ({ children }: PropsWithChildren) =>
      React.createElement(MockedProvider, { mocks, cache }, children)
    mockUseSecretsLazyQuery.mockImplementation((options: SecretsQueryOptions) =>
      useLazyQuery<CardSecretsEncryptedQuery, CardSecretsEncryptedQueryVariables>(
        CardSecretsEncryptedDocument,
        options,
      ),
    )
    mockFetchPublicKey.mockResolvedValue({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })

    const { result } = renderHook(() => useCardSecrets(), { wrapper })
    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

    expect(result.current.secrets).toEqual({ pan: "4242424242424242", cvc: "123" })
    expect(JSON.stringify(cache.extract())).not.toContain("encrypted-pan-data")
    expect(JSON.stringify(cache.extract())).not.toContain("encrypted-cvc-data")
  })
})
