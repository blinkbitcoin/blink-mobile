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

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (error: Error) => mockRecordAppError(error),
}))

const mockDecryptAesGcm = jest.fn(({ data }: { data: string }) => {
  if (data === "encrypted-pan-data") return "4242424242424242"
  if (data === "encrypted-cvc-data") return "123"
  return ""
})
jest.mock("@app/utils/crypto", () => ({
  generateRandomHexKey: () => "abcd1234abcd1234abcd1234abcd1234",
  encryptRsaOaep: () => "encrypted-session-id",
  decryptAesGcm: (params: { data: string }) => mockDecryptAesGcm(params),
}))

describe("useCardSecrets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSecretsLazyQuery.mockImplementation(() => [mockFetchEncryptedSecrets])
  })

  it("returns initial state with no secrets", () => {
    const { result } = renderHook(() => useCardSecrets())

    expect(result.current.secrets).toBeUndefined()
    expect(result.current.hasFailed).toBe(false)
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
    expect(result.current.hasFailed).toBe(false)
  })

  it("fails when the public key is not available", async () => {
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
    expect(result.current.hasFailed).toBe(true)
    expect(mockRecordAppError).toHaveBeenCalledWith(
      new Error("Card encryption public key is missing"),
    )
  })

  it("fails when the encrypted secrets are not available", async () => {
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
    expect(result.current.hasFailed).toBe(true)
    expect(mockRecordAppError).toHaveBeenCalledWith(
      new Error("Encrypted card secrets are missing"),
    )
  })

  it("reports a failed fetch and fails", async () => {
    mockFetchPublicKey.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() => useCardSecrets())

    let fetchResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      fetchResult = await result.current.fetchSecrets("card-123")
    })

    expect(fetchResult).toBeUndefined()
    expect(result.current.hasFailed).toBe(true)
    expect(mockRecordAppError).toHaveBeenCalledWith(new Error("Network error"))
  })

  it("fails for a throw that is not an Error", async () => {
    mockFetchPublicKey.mockRejectedValue("string error")

    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

    expect(result.current.hasFailed).toBe(true)
  })

  it("clears the previous failure when asked again", async () => {
    mockFetchPublicKey.mockRejectedValueOnce(new Error("Network error"))
    const { result } = renderHook(() => useCardSecrets())
    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

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
    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

    expect(result.current.hasFailed).toBe(false)
    expect(result.current.secrets).toEqual({ pan: "4242424242424242", cvc: "123" })
  })

  it("asks the server for the public key every time", async () => {
    mockFetchPublicKey.mockResolvedValue({ data: { cardEncryptionPublicKey: null } })
    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })

    expect(mockFetchPublicKey).toHaveBeenCalledWith({ fetchPolicy: "network-only" })
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

describe("useCardSecrets attempts", () => {
  type Answer<T> = { data: T }
  type PublicKeyAnswer = Answer<{ cardEncryptionPublicKey: string | null }>

  const publicKeyAnswer: PublicKeyAnswer = {
    data: {
      cardEncryptionPublicKey:
        "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    },
  }
  const secretsAnswer = {
    data: {
      cardSecretsEncrypted: {
        encryptedPan: { iv: "pan-iv", data: "encrypted-pan-data" },
        encryptedCvc: { iv: "cvc-iv", data: "encrypted-cvc-data" },
      },
    },
  }

  /** A public key request the test answers by hand, to hold an attempt open. */
  const deferredPublicKey = () => {
    let resolve: (answer: PublicKeyAnswer) => void = () => undefined
    let reject: (error: Error) => void = () => undefined
    const promise = new Promise<PublicKeyAnswer>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSecretsLazyQuery.mockImplementation(() => [mockFetchEncryptedSecrets])
    mockFetchEncryptedSecrets.mockResolvedValue(secretsAnswer)
  })

  it("takes the failure, and with it the retry, away as soon as it asks again", async () => {
    mockFetchPublicKey.mockRejectedValueOnce(new Error("Network error"))
    const { result } = renderHook(() => useCardSecrets())
    await act(async () => {
      await result.current.fetchSecrets("card-123")
    })
    expect(result.current.hasFailed).toBe(true)

    mockFetchPublicKey.mockReturnValue(deferredPublicKey().promise)
    act(() => {
      result.current.fetchSecrets("card-123")
    })

    expect(result.current.hasFailed).toBe(false)
  })

  it("keeps the newer answer when an older attempt fails after it", async () => {
    const older = deferredPublicKey()
    mockFetchPublicKey.mockReturnValueOnce(older.promise)
    mockFetchPublicKey.mockResolvedValueOnce(publicKeyAnswer)
    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      result.current.fetchSecrets("card-123")
      await result.current.fetchSecrets("card-123")
    })
    await act(async () => {
      older.reject(new Error("Network error"))
    })

    expect(result.current.secrets).toEqual({ pan: "4242424242424242", cvc: "123" })
    expect(result.current.hasFailed).toBe(false)
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  it("asks for no secrets with the key of an attempt a newer one replaced", async () => {
    const older = deferredPublicKey()
    mockFetchPublicKey.mockReturnValueOnce(older.promise)
    mockFetchPublicKey.mockResolvedValueOnce(publicKeyAnswer)
    const { result } = renderHook(() => useCardSecrets())
    await act(async () => {
      result.current.fetchSecrets("card-123")
      await result.current.fetchSecrets("card-123")
    })

    await act(async () => {
      older.resolve(publicKeyAnswer)
    })

    expect(mockFetchEncryptedSecrets).toHaveBeenCalledTimes(1)
  })

  /** The last check runs before decrypting, so a newer attempt can still start while the
   *  older one decrypts; the older answer is dropped on arrival all the same. */
  it("drops the answer of an attempt replaced while it decrypts", async () => {
    mockFetchPublicKey.mockResolvedValueOnce(publicKeyAnswer)
    mockFetchPublicKey.mockReturnValueOnce(deferredPublicKey().promise)
    const { result } = renderHook(() => useCardSecrets())
    mockDecryptAesGcm.mockImplementationOnce(() => {
      result.current.fetchSecrets("card-123")
      return "4242424242424242"
    })

    let olderResult: { pan: string; cvc: string } | undefined
    await act(async () => {
      olderResult = await result.current.fetchSecrets("card-123")
    })

    expect(olderResult).toBeUndefined()
    expect(result.current.secrets).toBeUndefined()
  })

  it("keeps the newer failure when an older attempt answers after it", async () => {
    const older = deferredPublicKey()
    mockFetchPublicKey.mockReturnValueOnce(older.promise)
    mockFetchPublicKey.mockRejectedValueOnce(new Error("Network error"))
    const { result } = renderHook(() => useCardSecrets())

    await act(async () => {
      result.current.fetchSecrets("card-123")
      await result.current.fetchSecrets("card-123")
    })
    await act(async () => {
      older.resolve(publicKeyAnswer)
    })

    expect(result.current.secrets).toBeUndefined()
    expect(result.current.hasFailed).toBe(true)
    expect(mockRecordAppError).toHaveBeenCalledTimes(1)
  })

  /** What lets the screen's fetch effect run once: nothing it depends on changes with
   *  a re-render, the locale included, since the hook no longer reads it. Run on the real
   *  lazy query, whose execute function Apollo keeps for the life of the component. */
  it("keeps the same fetchSecrets across renders", () => {
    mockUseSecretsLazyQuery.mockImplementation((options: SecretsQueryOptions) =>
      useLazyQuery<CardSecretsEncryptedQuery, CardSecretsEncryptedQueryVariables>(
        CardSecretsEncryptedDocument,
        options,
      ),
    )
    const wrapper = ({ children }: PropsWithChildren) =>
      React.createElement(MockedProvider, { mocks: [] }, children)
    const { result, rerender } = renderHook(() => useCardSecrets(), { wrapper })
    const { fetchSecrets } = result.current

    rerender({})

    expect(result.current.fetchSecrets).toBe(fetchSecrets)
  })
})
