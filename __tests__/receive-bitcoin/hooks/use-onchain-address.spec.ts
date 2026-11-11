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

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: ReadonlyArray<Record<string, unknown>>) => mockToastShow(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
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
    expect(result.current.failed).toBe(true)
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

  it("flags a rejected fetch as failed without a toast", async () => {
    // The screen shows the failure in the QR and offers New; a raw transport message
    // in a toast on top of it would be a second, different explanation.
    mockMutationFn.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useOnChainAddress("wallet-123"))

    await waitFor(() => {
      expect(result.current.error).toBe("Network failure")
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.failed).toBe(true)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("is not failed before a wallet id arrives, nor in the render it arrives", async () => {
    mockMutationFn.mockResolvedValue({
      data: { onChainAddressCurrent: { address: "bc1qlate" } },
    })
    const failedByRender: boolean[] = []
    const { result, rerender } = renderHook(
      ({ walletId }: { walletId?: string }) => {
        const hook = useOnChainAddress(walletId)
        failedByRender.push(hook.failed)
        return hook
      },
      { initialProps: {} as { walletId?: string } },
    )

    rerender({ walletId: "wallet-123" })
    await waitFor(() => expect(result.current.address).toBe("bc1qlate"))

    expect(failedByRender).not.toContain(true)
  })

  describe("when the wallet changes", () => {
    const renderOnWallet1 = async () => {
      mockMutationFn.mockResolvedValueOnce({
        data: { onChainAddressCurrent: { address: "bc1qwallet1" } },
      })
      const hook = renderHook(
        ({ walletId }: { walletId: string }) => useOnChainAddress(walletId),
        { initialProps: { walletId: "wallet-1" } },
      )
      await waitFor(() => expect(hook.result.current.address).toBe("bc1qwallet1"))
      return hook
    }

    it("drops the previous wallet's address while the new one loads", async () => {
      const { result, rerender } = await renderOnWallet1()
      mockMutationFn.mockReturnValueOnce(new Promise(() => {}))

      rerender({ walletId: "wallet-2" })

      expect(result.current.address).toBeNull()
      expect(result.current.getFullUriFn).toBeUndefined()
      expect(result.current.loading).toBe(true)
      expect(result.current.failed).toBe(false)
    })

    it("never returns the previous wallet's address, not even in the render that switches", async () => {
      // Regression: the address was cleared from an effect, so the first render on the
      // new wallet still handed the previous wallet's address to the QR, copy and share.
      mockMutationFn.mockResolvedValueOnce({
        data: { onChainAddressCurrent: { address: "bc1qwallet1" } },
      })
      const renders: { walletId: string; address: string | null; uri?: string }[] = []
      const { result, rerender } = renderHook(
        ({ walletId }: { walletId: string }) => {
          const hook = useOnChainAddress(walletId)
          renders.push({ walletId, address: hook.address, uri: hook.getFullUriFn?.({}) })
          return hook
        },
        { initialProps: { walletId: "wallet-1" } },
      )
      await waitFor(() => expect(result.current.address).toBe("bc1qwallet1"))
      mockMutationFn.mockReturnValueOnce(new Promise(() => {}))

      rerender({ walletId: "wallet-2" })

      const onWallet2 = renders.filter((r) => r.walletId === "wallet-2")
      expect(onWallet2.length).toBeGreaterThan(0)
      expect(onWallet2).toEqual(
        onWallet2.map(({ walletId }) => ({ walletId, address: null, uri: undefined })),
      )
    })

    it("fails instead of keeping the previous wallet's address when the fetch fails", async () => {
      // Regression: the previous wallet's address stayed on the new wallet's page for
      // good, so a payer scanning it paid the wrong wallet and New never appeared.
      const { result, rerender } = await renderOnWallet1()
      mockMutationFn.mockRejectedValueOnce(new Error("Network failure"))

      rerender({ walletId: "wallet-2" })

      await waitFor(() => expect(result.current.failed).toBe(true))
      expect(result.current.address).toBeNull()
      expect(result.current.getFullUriFn).toBeUndefined()
    })

    it("fails when the new wallet's fetch returns no address", async () => {
      const { result, rerender } = await renderOnWallet1()
      mockMutationFn.mockResolvedValueOnce({
        data: { onChainAddressCurrent: { address: null } },
      })

      rerender({ walletId: "wallet-2" })

      await waitFor(() => expect(result.current.failed).toBe(true))
      expect(result.current.address).toBeNull()
    })
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
      expect(mockReportError).toHaveBeenCalledWith(
        "onChainAddressCreate",
        new Error("network"),
      )
    })

    it("keeps the current address on screen while the create is in flight", async () => {
      mockCreateFn.mockReturnValueOnce(new Promise(() => {}))
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      act(() => {
        result.current.generateNewAddress()
      })

      expect(result.current.address).toBe("bc1qcurrent")
      expect(result.current.loading).toBe(false)
    })

    it("clears a failed load once New produces an address", async () => {
      mockMutationFn.mockRejectedValueOnce(new Error("offline"))
      mockCreateFn.mockResolvedValue({
        data: { onChainAddressCreate: { address: "bc1qfresh", errors: [] } },
      })
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.failed).toBe(true))

      await act(async () => {
        await result.current.generateNewAddress()
      })

      expect(result.current.address).toBe("bc1qfresh")
      expect(result.current.failed).toBe(false)
    })

    it("reports a create that returns no address with its error codes", async () => {
      mockCreateFn.mockResolvedValue({
        data: {
          onChainAddressCreate: {
            address: null,
            errors: [{ message: "nope", code: "INVALID_INPUT" }],
          },
        },
      })
      const { result } = renderHook(() => useOnChainAddress("wallet-123"))
      await waitFor(() => expect(result.current.address).toBe("bc1qcurrent"))

      await act(async () => {
        await result.current.generateNewAddress()
      })

      expect(mockReportError).toHaveBeenCalledWith(
        "onChainAddressCreate",
        new Error('onChainAddressCreate returned no address: ["INVALID_INPUT"]'),
      )
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

        await expect(outcome).resolves.toBe(NewOnchainAddressResult.Superseded)
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

        await expect(outcome).resolves.toBe(NewOnchainAddressResult.Superseded)
        expect(result.current.address).toBeNull()
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
      // Expected, and it has its own message: not an error worth a report.
      expect(mockReportError).not.toHaveBeenCalled()
    })
  })
})
