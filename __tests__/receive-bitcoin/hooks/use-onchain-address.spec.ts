import { renderHook } from "@testing-library/react-hooks"

import { WalletCurrency } from "@app/graphql/generated"
import { useOnChainAddress } from "@app/screens/receive-bitcoin-screen/hooks/use-onchain-address"

const mockReceiveOnchain = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ receiveOnchain: mockReceiveOnchain }),
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
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest" })

    const { result } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.address).toBeNull()
  })

  it("fetches address via the adapter on mount", async () => {
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest123" })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    expect(mockReceiveOnchain).toHaveBeenCalledTimes(1)
    expect(result.current.address).toBe("bc1qtest123")
    expect(result.current.loading).toBe(false)
  })

  it("does not fetch when adapter response has no address and no errors", async () => {
    mockReceiveOnchain.mockResolvedValue({})

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    expect(result.current.address).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("sets loading to false after fetch completes", async () => {
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qaddr" })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    expect(result.current.loading).toBe(true)

    await waitForNextUpdate()

    expect(result.current.loading).toBe(false)
  })

  it("returns undefined getFullUriFn when no address", () => {
    mockReceiveOnchain.mockResolvedValue({ errors: [{ message: "no address" }] })

    const { result } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    expect(result.current.getFullUriFn).toBeUndefined()
  })

  it("returns getFullUriFn when address is available", async () => {
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest" })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    expect(result.current.getFullUriFn).toBeDefined()
  })

  it("getFullUriFn generates correct bitcoin URI", async () => {
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest" })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    const uri = result.current.getFullUriFn?.({ uppercase: false, prefix: true })

    expect(uri).toBe("bitcoin:bc1qtest")
  })

  it("getFullUriFn includes amount when provided", async () => {
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qtest" })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc, amount: 100000 }),
    )

    await waitForNextUpdate()

    const uri = result.current.getFullUriFn?.({ uppercase: false, prefix: true })

    expect(uri).toContain("amount=")
  })

  it("does not set address when response has no address", async () => {
    mockReceiveOnchain.mockResolvedValue({ errors: [{ message: "missing" }] })

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    expect(result.current.address).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("toasts a warning when the adapter rejects", async () => {
    mockReceiveOnchain.mockRejectedValue(new Error("Network failure"))

    const { result, waitForNextUpdate } = renderHook(() =>
      useOnChainAddress({ walletCurrency: WalletCurrency.Btc }),
    )

    await waitForNextUpdate()

    expect(result.current.loading).toBe(false)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Network failure", type: "warning" }),
    )
  })

  it("does not toast when the adapter returns errors payload without throwing", async () => {
    mockReceiveOnchain.mockResolvedValue({ errors: [{ message: "upstream failed" }] })

    renderHook(() => useOnChainAddress({ walletCurrency: WalletCurrency.Btc }))

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
