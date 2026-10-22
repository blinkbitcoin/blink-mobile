import { act, renderHook, waitFor } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"
import { useOnChainAddress } from "@app/screens/receive-bitcoin-screen/hooks/use-onchain-address"
import {
  NewOnchainAddressResult,
  type NewOnchainAddressResultType,
} from "@app/screens/receive-bitcoin-screen/payment/request-state.types"

const mockMutationFn = jest.fn()
const mockCreateFn = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useOnChainAddressCurrentMutation: () => [mockMutationFn],
  useOnChainAddressCreateMutation: () => [mockCreateFn],
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

  it("returns loading true initially", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qtest" } },
    })

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    expect(result.current.loading).toBe(true)
    expect(result.current.address).toBeNull()
    await flushEffects()
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

  describe("generateNewAddress", () => {
    beforeEach(() => {
      mockMutationFn.mockResolvedValue({
        data: { onChainAddressCurrent: { address: "bc1qcurrent" } },
      })
    })

    it("replaces the address with a freshly created one", async () => {
      mockCreateFn.mockResolvedValue({
        data: { onChainAddressCreate: { address: "bc1qfresh", errors: [] } },
      })
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      let outcome: NewOnchainAddressResultType | undefined
      await act(async () => {
        outcome = await result.current.generateNewAddress()
      })

      expect(outcome).toBe(NewOnchainAddressResult.Created)
      expect(mockCreateFn).toHaveBeenCalledWith({
        variables: { input: { walletId: "wallet-123" } },
      })
      expect(result.current.address).toBe("bc1qfresh")
      expect(result.current.loading).toBe(false)
    })

    it("keeps the current address when creation fails", async () => {
      mockCreateFn.mockRejectedValue(new Error("network"))
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      let outcome: NewOnchainAddressResultType | undefined
      await act(async () => {
        outcome = await result.current.generateNewAddress()
      })

      expect(outcome).toBe(NewOnchainAddressResult.Failed)
      expect(result.current.address).toBe("bc1qcurrent")
      expect(result.current.loading).toBe(false)
    })

    it("keeps the current address when the API returns none", async () => {
      mockCreateFn.mockResolvedValue({
        data: { onChainAddressCreate: { address: null, errors: [{ message: "x" }] } },
      })
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      let outcome: NewOnchainAddressResultType | undefined
      await act(async () => {
        outcome = await result.current.generateNewAddress()
      })

      expect(outcome).toBe(NewOnchainAddressResult.Failed)
      expect(result.current.address).toBe("bc1qcurrent")
    })

    describe("when the wallet changes while a request is pending", () => {
      type Deferred = { promise: Promise<unknown>; resolve: (value: unknown) => void }
      const deferred = (): Deferred => {
        let resolve: (value: unknown) => void = () => {}
        const promise = new Promise((res) => {
          resolve = res
        })
        return { promise, resolve }
      }
      const current = (address: string) => ({
        data: { onChainAddressCurrent: { address } },
      })
      const created = (address: string) => ({
        data: { onChainAddressCreate: { address, errors: [] } },
      })

      const renderOnWallet1 = async () => {
        const hook = renderHook(
          ({ walletId }: { walletId: string }) => useOnChainAddress(walletId),
          { initialProps: { walletId: "wallet-1" } },
        )
        await waitFor(() => expect(hook.result.current.address).toBe("bc1qcurrent"))
        return hook
      }

      it("ignores a create that lands after the new wallet's address", async () => {
        const create = deferred()
        const fetchWallet2 = deferred()
        mockCreateFn.mockReturnValueOnce(create.promise)
        const { result, rerender } = await renderOnWallet1()

        let outcome: Promise<NewOnchainAddressResultType> | undefined
        act(() => {
          outcome = result.current.generateNewAddress()
        })
        mockMutationFn.mockReturnValueOnce(fetchWallet2.promise)
        rerender({ walletId: "wallet-2" })

        await act(async () => fetchWallet2.resolve(current("bc1qwallet2")))
        await waitFor(() => expect(result.current.address).toBe("bc1qwallet2"))

        await act(async () => create.resolve(created("bc1qstale")))

        await expect(outcome).resolves.toBe(NewOnchainAddressResult.Failed)
        expect(result.current.address).toBe("bc1qwallet2")
        expect(result.current.loading).toBe(false)
      })

      it("keeps loading when a stale create lands before the new wallet's address", async () => {
        const create = deferred()
        const fetchWallet2 = deferred()
        mockCreateFn.mockReturnValueOnce(create.promise)
        const { result, rerender } = await renderOnWallet1()

        let outcome: Promise<NewOnchainAddressResultType> | undefined
        act(() => {
          outcome = result.current.generateNewAddress()
        })
        mockMutationFn.mockReturnValueOnce(fetchWallet2.promise)
        rerender({ walletId: "wallet-2" })

        await act(async () => create.resolve(created("bc1qstale")))

        await expect(outcome).resolves.toBe(NewOnchainAddressResult.Failed)
        expect(result.current.address).toBe("bc1qcurrent")
        expect(result.current.loading).toBe(true)

        await act(async () => fetchWallet2.resolve(current("bc1qwallet2")))
        await waitFor(() => expect(result.current.address).toBe("bc1qwallet2"))
        expect(result.current.loading).toBe(false)
      })

      it("ignores the previous wallet's address when it lands last", async () => {
        const fetchWallet1 = deferred()
        mockMutationFn.mockReturnValueOnce(fetchWallet1.promise)
        const { result, rerender } = renderHook(
          ({ walletId }: { walletId: string }) => useOnChainAddress(walletId),
          { initialProps: { walletId: "wallet-1" } },
        )

        mockMutationFn.mockResolvedValueOnce(current("bc1qwallet2"))
        rerender({ walletId: "wallet-2" })
        await waitFor(() => expect(result.current.address).toBe("bc1qwallet2"))

        await act(async () => fetchWallet1.resolve(current("bc1qwallet1")))

        expect(result.current.address).toBe("bc1qwallet2")
        expect(result.current.loading).toBe(false)
      })
    })

    it("reports the rate limit apart from other failures", async () => {
      mockCreateFn.mockResolvedValue({
        data: {
          onChainAddressCreate: {
            address: null,
            errors: [{ message: "Too many", code: "TOO_MANY_REQUEST" }],
          },
        },
      })
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      let outcome: NewOnchainAddressResultType | undefined
      await act(async () => {
        outcome = await result.current.generateNewAddress()
      })

      expect(outcome).toBe(NewOnchainAddressResult.RateLimited)
      expect(result.current.address).toBe("bc1qcurrent")
      expect(result.current.loading).toBe(false)
    })
  })
})
