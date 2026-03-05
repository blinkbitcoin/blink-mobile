import { renderHook, act } from "@testing-library/react-hooks"

import { useNfcReceive } from "@app/screens/receive-bitcoin-screen/hooks/use-nfc-receive"
import {
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

const mockIsSupported = jest.fn()
jest.mock("react-native-nfc-manager", () => ({
  isSupported: () => mockIsSupported(),
}))

const defaultParams = {
  requestType: Invoice.Lightning,
  requestState: PaymentRequestState.Created,
  hasSettlementAmount: true,
  handleSetAmount: jest.fn(),
  isOnChainPage: false,
}

describe("useNfcReceive", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsSupported.mockResolvedValue(true)
  })

  it("detects NFC support on mount", async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNfcReceive(defaultParams))

    await waitForNextUpdate()

    expect(result.current.showNfcButton).toBe(true)
  })

  it("hides NFC button when device does not support NFC", () => {
    mockIsSupported.mockResolvedValue(false)

    const { result } = renderHook(() => useNfcReceive(defaultParams))

    // nfcSupported starts false, resolving false causes no re-render
    expect(result.current.showNfcButton).toBe(false)
  })

  it("hides NFC button when on onchain page", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, isOnChainPage: true }),
    )

    await waitForNextUpdate()

    expect(result.current.showNfcButton).toBe(false)
  })

  it("hides NFC button when request state is not Created", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, requestState: PaymentRequestState.Loading }),
    )

    await waitForNextUpdate()

    expect(result.current.showNfcButton).toBe(false)
  })

  it("shows NFC button for PayCode type", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, requestType: Invoice.PayCode }),
    )

    await waitForNextUpdate()

    expect(result.current.showNfcButton).toBe(true)
  })

  it("hides NFC button for OnChain type", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, requestType: Invoice.OnChain }),
    )

    await waitForNextUpdate()

    expect(result.current.showNfcButton).toBe(false)
  })

  it("opens amount modal when pressing NFC without settlement amount", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, hasSettlementAmount: false }),
    )

    await waitForNextUpdate()

    act(() => {
      result.current.onNfcPress()
    })

    expect(result.current.isNfcAmountModalOpen).toBe(true)
    expect(result.current.displayReceiveNfc).toBe(false)
  })

  it("shows NFC receive directly when pressing with settlement amount", async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNfcReceive(defaultParams))

    await waitForNextUpdate()

    act(() => {
      result.current.onNfcPress()
    })

    expect(result.current.displayReceiveNfc).toBe(true)
    expect(result.current.isNfcAmountModalOpen).toBe(false)
  })

  it("closes NFC amount modal", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, hasSettlementAmount: false }),
    )

    await waitForNextUpdate()

    act(() => {
      result.current.onNfcPress()
    })

    expect(result.current.isNfcAmountModalOpen).toBe(true)

    act(() => {
      result.current.closeNfcAmountModal()
    })

    expect(result.current.isNfcAmountModalOpen).toBe(false)
  })

  it("handleNfcAmountSet calls handleSetAmount and closes modal", async () => {
    const handleSetAmount = jest.fn()
    const { result, waitForNextUpdate } = renderHook(() =>
      useNfcReceive({ ...defaultParams, hasSettlementAmount: false, handleSetAmount }),
    )

    await waitForNextUpdate()

    act(() => {
      result.current.onNfcPress()
    })

    const amount: MoneyAmount<WalletOrDisplayCurrency> = {
      amount: 1000,
      currency: "BTC",
      currencyCode: "BTC",
    }

    act(() => {
      result.current.handleNfcAmountSet(amount)
    })

    expect(handleSetAmount).toHaveBeenCalledWith(amount)
    expect(result.current.isNfcAmountModalOpen).toBe(false)
  })

  it("handles NFC support check failure gracefully", () => {
    mockIsSupported.mockRejectedValue(new Error("NFC error"))

    const { result } = renderHook(() => useNfcReceive(defaultParams))

    // catch sets nfcSupported to false (already the default), no re-render
    expect(result.current.showNfcButton).toBe(false)
  })

  it("initializes with displayReceiveNfc false", () => {
    mockIsSupported.mockResolvedValue(false)
    const { result } = renderHook(() => useNfcReceive(defaultParams))

    expect(result.current.displayReceiveNfc).toBe(false)
  })

  it("setDisplayReceiveNfc updates state", async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNfcReceive(defaultParams))

    await waitForNextUpdate()

    act(() => {
      result.current.setDisplayReceiveNfc(true)
    })

    expect(result.current.displayReceiveNfc).toBe(true)

    act(() => {
      result.current.setDisplayReceiveNfc(false)
    })

    expect(result.current.displayReceiveNfc).toBe(false)
  })
})
