import { renderHook, waitFor } from "@testing-library/react-native"

import { useOnChainAddress } from "@app/screens/receive-bitcoin-screen/hooks/use-onchain-address"

const mockMutationFn = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useOnChainAddressCurrentMutation: () => [mockMutationFn],
}))

const mockLL = {}
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: ReadonlyArray<Record<string, unknown>>) => mockToastShow(...args),
}))

describe("useOnChainAddress", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns loading true initially", () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    expect(result.current.loading).toBe(true)
    expect(result.current.address).toBeNull()
  })

  it("fetches address when walletId is provided", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest123" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qtest123")
    })

    expect(mockMutationFn).toHaveBeenCalledWith({
      variables: { input: { walletId: "wallet-123" } },
    })
    expect(result.current.loading).toBe(false)
  })

  it("does not fetch when walletId is undefined", () => {
    const { result } = renderHook(() => useOnChainAddress(undefined))

    expect(mockMutationFn).not.toHaveBeenCalled()
    expect(result.current.address).toBeNull()
  })

  it("sets loading to false after fetch completes", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qaddr" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it("returns undefined getFullUriFn when no address", () => {
    const { result } = renderHook(() => useOnChainAddress(undefined))

    expect(result.current.getFullUriFn).toBeUndefined()
  })

  it("returns getFullUriFn when address is available", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.getFullUriFn).toBeDefined()
    })
  })

  it("getFullUriFn generates correct bitcoin URI", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qtest")
    })

    const uri = result.current.getFullUriFn?.({ uppercase: false, prefix: true })

    expect(uri).toBe("bitcoin:bc1qtest")
  })

  it("getFullUriFn includes amount when provided", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() =>
      useOnChainAddress("wallet-123", { amount: 100000 }),
    )

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qtest")
    })

    const uri = result.current.getFullUriFn?.({ uppercase: false, prefix: true })

    expect(uri).toContain("amount=")
  })

  it("refetches when walletId changes", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qfirst" } },
    })

    const { result, rerender } = renderHook(
      ({ walletId }: { walletId: string }) => useOnChainAddress(walletId),
      { initialProps: { walletId: "wallet-1" } },
    )

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qfirst")
    })

    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qsecond" } },
    })

    rerender({ walletId: "wallet-2" })

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qsecond")
    })

    expect(mockMutationFn).toHaveBeenCalledTimes(2)
  })

  it("does not set address when response has no address", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: null } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.address).toBeNull()
  })

  it("returns null error on success", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qtest")
    })

    expect(result.current.error).toBeNull()
  })

  it("exposes error when mutation rejects", async () => {
    mockMutationFn.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.error).toBe("Network failure")
    })

    expect(result.current.loading).toBe(false)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network failure", type: "warning" }),
    )
  })

  it("resets error when walletId changes", async () => {
    mockMutationFn.mockRejectedValueOnce(new Error("First error"))

    const { result, rerender } = renderHook(
      ({ walletId }: { walletId: string }) => useOnChainAddress(walletId),
      { initialProps: { walletId: "wallet-1" } },
    )

    await waitFor(() => {
      expect(result.current.error).toBe("First error")
    })

    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qnew" } },
    })

    rerender({ walletId: "wallet-2" })

    await waitFor(() => {
      expect(result.current.address).toBe("bc1qnew")
    })

    expect(result.current.error).toBeNull()
  })
})
