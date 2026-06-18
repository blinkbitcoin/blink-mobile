import { renderHook, act } from "@testing-library/react-native"

import { useCardEncryption } from "@app/screens/card-screen/hooks/use-card-encryption"

const mockLazyQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCardEncryptionPublicKeyLazyQuery: () => [mockLazyQuery, { loading: false }],
}))

describe("useCardEncryption", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns fetchPublicKey and loading", () => {
    const { result } = renderHook(() => useCardEncryption())

    expect(result.current.fetchPublicKey).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it("calls the lazy query when fetchPublicKey is invoked", async () => {
    mockLazyQuery.mockResolvedValue({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })

    const { result } = renderHook(() => useCardEncryption())

    let response: ReturnType<typeof mockLazyQuery> | undefined
    await act(async () => {
      response = await result.current.fetchPublicKey()
    })

    expect(mockLazyQuery).toHaveBeenCalled()
    expect(response).toEqual({
      data: {
        cardEncryptionPublicKey:
          "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      },
    })
  })
})
