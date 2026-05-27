import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useOnchainResolver } from "@app/screens/receive-bitcoin-screen/hooks/use-onchain-resolver"

const mockUseOnChainAddress = jest.fn()

jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-onchain-address", () => ({
  useOnChainAddress: (...args: unknown[]) => mockUseOnChainAddress(...args),
}))

jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-payment-request", () => ({
  usePaymentRequest: jest.fn(),
}))

type TestState = {
  settlementAmount?: { amount: number }
  memo?: string
}

const buildState = (overrides: TestState = {}): TestState =>
  ({
    settlementAmount: { amount: 1000 },
    memo: "",
    ...overrides,
  }) as never

describe("useOnchainResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseOnChainAddress.mockReturnValue({
      address: "bc1qaddress",
      loading: false,
      getFullUriFn: () => "bitcoin:bc1qaddress",
    })
  })

  it("returns the adapter-resolved onchain address", () => {
    const state = buildState()

    const { result } = renderHook(() =>
      useOnchainResolver(state as never, WalletCurrency.Btc),
    )

    expect(result.current.address).toBe("bc1qaddress")
    expect(result.current.loading).toBe(false)
    expect(mockUseOnChainAddress).toHaveBeenCalledWith({
      walletCurrency: WalletCurrency.Btc,
      amount: 1000,
      memo: undefined,
    })
  })

  it("forwards memo when present", () => {
    const state = buildState({ memo: "hello" })

    renderHook(() => useOnchainResolver(state as never, WalletCurrency.Btc))

    expect(mockUseOnChainAddress).toHaveBeenCalledWith(
      expect.objectContaining({ memo: "hello" }),
    )
  })

  it("reports loading state from the underlying hook", () => {
    mockUseOnChainAddress.mockReturnValue({
      address: null,
      loading: true,
      getFullUriFn: undefined,
    })
    const state = buildState()

    const { result } = renderHook(() =>
      useOnchainResolver(state as never, WalletCurrency.Btc),
    )

    expect(result.current.address).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it("exposes getFullUriFn from the underlying hook", () => {
    const state = buildState()

    const { result } = renderHook(() =>
      useOnchainResolver(state as never, WalletCurrency.Btc),
    )

    expect(result.current.getFullUriFn?.({ prefix: true })).toBe("bitcoin:bc1qaddress")
  })
})
