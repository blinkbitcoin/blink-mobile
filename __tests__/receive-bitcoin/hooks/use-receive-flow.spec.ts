import { renderHook, act } from "@testing-library/react-hooks"

import { useReceiveFlow } from "@app/screens/receive-bitcoin-screen/hooks/use-receive-flow"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { WalletCurrency } from "@app/graphql/generated"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

const mockCopyToClipboard = jest.fn()
const mockShare = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-payment-actions", () => ({
  usePaymentActions: () => ({
    copyToClipboard: mockCopyToClipboard,
    share: mockShare,
  }),
}))

const mockReceiveViaNFC = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-lnurl-withdraw", () => ({
  useLnurlWithdraw: () => mockReceiveViaNFC,
}))

const zeroAmount: MoneyAmount<WalletOrDisplayCurrency> = {
  amount: 0,
  currency: "BTC",
  currencyCode: "BTC",
}

const nonZeroAmount: MoneyAmount<WalletOrDisplayCurrency> = {
  amount: 1000,
  currency: "BTC",
  currencyCode: "BTC",
}

type MockRequest = {
  pr: null
  setAmount: jest.Mock
  setType: jest.Mock
  setMemo: jest.Mock
  setReceivingWallet: jest.Mock
  type: string
  state: string
  canUsePaycode: boolean
  memoChangeText: string | null
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  receivingWalletDescriptor: { currency: WalletCurrency }
}

const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  pr: null,
  setAmount: jest.fn(),
  setType: jest.fn(),
  setMemo: jest.fn(),
  setReceivingWallet: jest.fn(),
  type: Invoice.Lightning,
  state: "Created",
  canUsePaycode: true,
  memoChangeText: null,
  unitOfAccountAmount: zeroAmount,
  receivingWalletDescriptor: { currency: WalletCurrency.Btc },
  ...overrides,
})

const defaultCarousel = {
  isOnChainPage: false,
  onchainWalletCurrency: WalletCurrency.Btc,
  syncOnchainWallet: jest.fn(),
  onchainAddress: null,
}

describe("useReceiveFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("handleSetAmount", () => {
    it("calls setAmount on the request", () => {
      const request = createMockRequest()
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleSetAmount(nonZeroAmount)
      })

      expect(request.setAmount).toHaveBeenCalledWith(nonZeroAmount)
    })

    it("switches from PayCode to Lightning when amount is non-zero", () => {
      const request = createMockRequest({ type: Invoice.PayCode })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleSetAmount(nonZeroAmount)
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.Lightning)
    })

    it("switches from Lightning to PayCode when amount is zero and canUsePaycode", () => {
      const request = createMockRequest({
        type: Invoice.Lightning,
        canUsePaycode: true,
        memoChangeText: null,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleSetAmount(zeroAmount)
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.PayCode)
    })

    it("does not switch to PayCode when memo is set", () => {
      const request = createMockRequest({
        type: Invoice.Lightning,
        canUsePaycode: true,
        memoChangeText: "some memo",
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleSetAmount(zeroAmount)
      })

      expect(request.setType).not.toHaveBeenCalled()
    })

    it("does not switch to PayCode when canUsePaycode is false", () => {
      const request = createMockRequest({
        type: Invoice.Lightning,
        canUsePaycode: false,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleSetAmount(zeroAmount)
      })

      expect(request.setType).not.toHaveBeenCalled()
    })
  })

  describe("handleMemoBlur", () => {
    it("calls setMemo on the request", () => {
      const request = createMockRequest()
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleMemoBlur()
      })

      expect(request.setMemo).toHaveBeenCalled()
    })

    it("switches from PayCode to Lightning when memo is present", () => {
      const request = createMockRequest({
        type: Invoice.PayCode,
        memoChangeText: "test memo",
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleMemoBlur()
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.Lightning)
    })

    it("switches from Lightning to PayCode when memo cleared and canUsePaycode", () => {
      const request = createMockRequest({
        type: Invoice.Lightning,
        canUsePaycode: true,
        memoChangeText: null,
        unitOfAccountAmount: zeroAmount,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleMemoBlur()
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.PayCode)
    })

    it("does not switch to PayCode when amount is non-zero", () => {
      const request = createMockRequest({
        type: Invoice.Lightning,
        canUsePaycode: true,
        memoChangeText: null,
        unitOfAccountAmount: nonZeroAmount,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleMemoBlur()
      })

      expect(request.setType).not.toHaveBeenCalled()
    })
  })

  describe("handleToggleWallet", () => {
    it("toggles from BTC to USD", () => {
      const request = createMockRequest({
        receivingWalletDescriptor: { currency: WalletCurrency.Btc },
      })
      const carousel = { ...defaultCarousel }

      const { result } = renderHook(() => useReceiveFlow(request as never, carousel))

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setReceivingWallet).toHaveBeenCalledWith(WalletCurrency.Usd)
      expect(carousel.syncOnchainWallet).toHaveBeenCalledWith(WalletCurrency.Usd)
    })

    it("toggles from USD to BTC", () => {
      const request = createMockRequest({
        receivingWalletDescriptor: { currency: WalletCurrency.Usd },
      })
      const carousel = { ...defaultCarousel }

      const { result } = renderHook(() => useReceiveFlow(request as never, carousel))

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setReceivingWallet).toHaveBeenCalledWith(WalletCurrency.Btc)
      expect(carousel.syncOnchainWallet).toHaveBeenCalledWith(WalletCurrency.Btc)
    })

    it("reverts to PayCode when switching to BTC with no content and canUsePaycode", () => {
      const request = createMockRequest({
        receivingWalletDescriptor: { currency: WalletCurrency.Usd },
        canUsePaycode: true,
        memoChangeText: null,
        unitOfAccountAmount: zeroAmount,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.PayCode)
    })

    it("stays on Lightning when switching to BTC with non-zero amount", () => {
      const request = createMockRequest({
        receivingWalletDescriptor: { currency: WalletCurrency.Usd },
        canUsePaycode: true,
        unitOfAccountAmount: nonZeroAmount,
      })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setType).toHaveBeenCalledWith(Invoice.Lightning)
    })

    it("uses onchainWalletCurrency when on chain page", () => {
      const request = createMockRequest({
        receivingWalletDescriptor: { currency: WalletCurrency.Btc },
      })
      const carousel = {
        ...defaultCarousel,
        isOnChainPage: true,
        onchainWalletCurrency: WalletCurrency.Btc,
      }

      const { result } = renderHook(() => useReceiveFlow(request as never, carousel))

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setReceivingWallet).toHaveBeenCalledWith(WalletCurrency.Usd)
    })

    it("does nothing when not ready (Loading state)", () => {
      const request = createMockRequest({ state: "Loading" })
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleToggleWallet()
      })

      expect(request.setReceivingWallet).not.toHaveBeenCalled()
    })
  })

  describe("delegated actions", () => {
    it("exposes handleCopy from usePaymentActions", () => {
      const request = createMockRequest()
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleCopy()
      })

      expect(mockCopyToClipboard).toHaveBeenCalled()
    })

    it("exposes handleShare from usePaymentActions", () => {
      const request = createMockRequest()
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      act(() => {
        result.current.handleShare()
      })

      expect(mockShare).toHaveBeenCalled()
    })

    it("exposes receiveViaNFC from useLnurlWithdraw", () => {
      const request = createMockRequest()
      const { result } = renderHook(() =>
        useReceiveFlow(request as never, defaultCarousel),
      )

      expect(result.current.receiveViaNFC).toBe(mockReceiveViaNFC)
    })
  })
})
