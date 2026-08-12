import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"

import { useOnchainResolver } from "@app/screens/receive-bitcoin-screen/hooks/use-onchain-resolver"

const mockUseOnChainAddress = jest.fn()

jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-onchain-address", () => ({
  useOnChainAddress: (...args: unknown[]) => mockUseOnChainAddress(...args),
}))

// `use-payment-request` is imported at the module level solely for its
// return-type; neutralise it so importing this file doesn't pull in the
// whole custodial request stack.
jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-payment-request", () => ({
  usePaymentRequest: jest.fn(),
}))

type TestState = {
  btcWalletId?: string
  usdWalletId?: string
  settlementAmount?: { amount: number }
  memo?: string
  onchainAddress?: string
  getOnchainFullUriFn?: () => string
}

const buildState = (overrides: TestState = {}): TestState =>
  ({
    btcWalletId: "btc-w",
    usdWalletId: "usd-w",
    settlementAmount: { amount: 1000 },
    memo: "",
    ...overrides,
  }) as never

describe("useOnchainResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseOnChainAddress.mockReturnValue({
      address: "bc1qcustodial",
      loading: false,
      getFullUriFn: () => "bitcoin:bc1qcustodial",
    })
  })

  it("returns the custodial onchain address when not self-custodial", () => {
    const state = buildState()

    const { result } = renderHook(() =>
      useOnchainResolver(false, state as never, WalletCurrency.Btc),
    )

    expect(result.current.address).toBe("bc1qcustodial")
    expect(result.current.loading).toBe(false)
    expect(mockUseOnChainAddress).toHaveBeenCalledWith("btc-w", {
      amount: 1000,
      memo: undefined,
    })
  })

  it("passes usd wallet id when receiving currency is USD", () => {
    const state = buildState()

    renderHook(() => useOnchainResolver(false, state as never, WalletCurrency.Usd))

    expect(mockUseOnChainAddress).toHaveBeenCalledWith(
      "usd-w",
      expect.objectContaining({ amount: 1000 }),
    )
  })

  it("forwards memo to the custodial hook when present", () => {
    const state = buildState({ memo: "hello" })

    renderHook(() => useOnchainResolver(false, state as never, WalletCurrency.Btc))

    expect(mockUseOnChainAddress).toHaveBeenCalledWith(
      "btc-w",
      expect.objectContaining({ memo: "hello" }),
    )
  })

  it("skips the custodial onchain hook (wallet id undefined) when self-custodial", () => {
    const state = buildState({
      onchainAddress: "bc1qself",
      getOnchainFullUriFn: () => "bitcoin:bc1qself",
    })

    renderHook(() => useOnchainResolver(true, state as never, WalletCurrency.Btc))

    expect(mockUseOnChainAddress).toHaveBeenCalledWith(undefined, expect.any(Object))
  })

  it("returns the self-custodial onchain address + loading=false once available", () => {
    const state = buildState({
      onchainAddress: "bc1qself",
      getOnchainFullUriFn: () => "bitcoin:bc1qself",
    })

    const { result } = renderHook(() =>
      useOnchainResolver(true, state as never, WalletCurrency.Btc),
    )

    expect(result.current.address).toBe("bc1qself")
    expect(result.current.loading).toBe(false)
    expect(result.current.getFullUriFn?.({ prefix: true })).toBe("bitcoin:bc1qself")
  })

  it("reports loading=true while the self-custodial onchain address is still null", () => {
    const state = buildState({ onchainAddress: undefined })

    const { result } = renderHook(() =>
      useOnchainResolver(true, state as never, WalletCurrency.Btc),
    )

    expect(result.current.address).toBeNull()
    expect(result.current.loading).toBe(true)
  })
})
