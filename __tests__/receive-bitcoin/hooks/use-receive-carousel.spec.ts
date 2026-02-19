import { renderHook, act } from "@testing-library/react-hooks"

import { useReceiveCarousel } from "@app/screens/receive-bitcoin-screen/hooks/use-receive-carousel"
import { WalletCurrency } from "@app/graphql/generated"

const mockUseLevel = jest.fn()
jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { Zero: "ZERO", One: "ONE", Two: "TWO" },
  useLevel: () => mockUseLevel(),
}))

const mockOnChainAddress = {
  address: "bc1qtest",
  loading: false,
  getFullUriFn: jest.fn(),
}

jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-onchain-address", () => ({
  useOnChainAddress: () => mockOnChainAddress,
}))

type MockRequest = {
  btcWalletId: string
  usdWalletId: string
  settlementAmount: { amount: number } | undefined
  memo: string
  receivingWalletDescriptor: { currency: WalletCurrency }
}

const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  btcWalletId: "btc-wallet-id",
  usdWalletId: "usd-wallet-id",
  settlementAmount: undefined,
  memo: "",
  receivingWalletDescriptor: { currency: WalletCurrency.Btc },
  ...overrides,
})

describe("useReceiveCarousel", () => {
  const onLevelZeroBlock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLevel.mockReturnValue({ currentLevel: "ONE" })
  })

  it("starts on Lightning page", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    expect(result.current.isOnChainPage).toBe(false)
  })

  it("provides carousel ref", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    expect(result.current.ref).toBeDefined()
  })

  it("initializes onchainWalletCurrency as BTC", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    expect(result.current.onchainWalletCurrency).toBe(WalletCurrency.Btc)
  })

  it("switches to OnChain page on snap to index 1", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.handleSnap(1)
    })

    expect(result.current.isOnChainPage).toBe(true)
  })

  it("switches back to Lightning page on snap to index 0", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.handleSnap(1)
    })

    expect(result.current.isOnChainPage).toBe(true)

    act(() => {
      result.current.handleSnap(0)
    })

    expect(result.current.isOnChainPage).toBe(false)
  })

  it("syncs onchain wallet currency on snap to onchain page", () => {
    const request = createMockRequest({
      receivingWalletDescriptor: { currency: WalletCurrency.Usd },
    })
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.handleSnap(1)
    })

    expect(result.current.onchainWalletCurrency).toBe(WalletCurrency.Usd)
  })

  it("blocks onchain for level zero users", () => {
    mockUseLevel.mockReturnValue({ currentLevel: "ZERO" })
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.handleSnap(1)
    })

    expect(onLevelZeroBlock).toHaveBeenCalled()
    expect(result.current.isOnChainPage).toBe(false)
  })

  it("allows onchain for non-zero level users", () => {
    mockUseLevel.mockReturnValue({ currentLevel: "ONE" })
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.handleSnap(1)
    })

    expect(onLevelZeroBlock).not.toHaveBeenCalled()
    expect(result.current.isOnChainPage).toBe(true)
  })

  it("syncOnchainWallet updates onchain wallet currency", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    act(() => {
      result.current.syncOnchainWallet(WalletCurrency.Usd)
    })

    expect(result.current.onchainWalletCurrency).toBe(WalletCurrency.Usd)
  })

  it("exposes onchain state from useOnChainAddress", () => {
    const request = createMockRequest()
    const { result } = renderHook(() =>
      useReceiveCarousel(
        request as Parameters<typeof useReceiveCarousel>[0],
        onLevelZeroBlock,
      ),
    )

    expect(result.current.onchain.address).toBe("bc1qtest")
    expect(result.current.onchain.loading).toBe(false)
  })
})
