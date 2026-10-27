import { renderHook } from "@testing-library/react-hooks"

import { useDisplayPaymentRequest } from "@app/screens/receive-bitcoin-screen/hooks/use-display-payment-request"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockGetLightningAddress = jest.fn()
jest.mock("@app/utils/pay-links", () => ({
  getLightningAddress: (...args: ReadonlyArray<string>) =>
    mockGetLightningAddress(...args),
}))

const mockTruncateMiddle = jest.fn((s: string) => s)
jest.mock("@app/screens/receive-bitcoin-screen/payment/helpers", () => ({
  truncateMiddle: (s: string) => mockTruncateMiddle(s),
}))

type MockRequestState = {
  type: string
  canUsePaycode: boolean
  info: {
    data: {
      invoiceType: string
      getFullUriFn: (params: Record<string, boolean>) => string
      username: string
    } | null
  } | null
  lnAddressHostname: string
}

const baseLightningRequest: MockRequestState = {
  type: Invoice.Lightning,
  canUsePaycode: false,
  info: {
    data: {
      invoiceType: Invoice.Lightning,
      getFullUriFn: () => "lnbc1longpaymentrequest",
      username: "",
    },
  },
  lnAddressHostname: "blink.sv",
}

const basePayCodeRequest: MockRequestState = {
  type: Invoice.PayCode,
  canUsePaycode: true,
  info: {
    data: {
      invoiceType: Invoice.PayCode,
      getFullUriFn: () => "",
      username: "testuser",
    },
  },
  lnAddressHostname: "blink.sv",
}

describe("useDisplayPaymentRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTruncateMiddle.mockImplementation(
      (s: string) => `${s.slice(0, 5)}...${s.slice(-5)}`,
    )
    mockGetLightningAddress.mockImplementation(
      (hostname: string, user: string) => `${user}@${hostname}`,
    )
  })

  describe("lightning invoice", () => {
    it("returns truncated full URI for lightning invoice", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          false,
          { address: null, failed: false },
        ),
      )

      expect(mockTruncateMiddle).toHaveBeenCalledWith("lnbc1longpaymentrequest")
      expect(result.current.displayPaymentRequest).toBeTruthy()
    })

    it("shows actions for lightning invoice", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          false,
          { address: null, failed: false },
        ),
      )

      expect(result.current.showActions).toBe(true)
    })
  })

  describe("paycode", () => {
    it("returns lightning address for paycode", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          basePayCodeRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          false,
          { address: null, failed: false },
        ),
      )

      expect(mockGetLightningAddress).toHaveBeenCalledWith("blink.sv", "testuser")
      expect(result.current.displayPaymentRequest).toBe("testuser@blink.sv")
    })

    it("shows actions when canUsePaycode is true", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          basePayCodeRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          false,
          { address: null, failed: false },
        ),
      )

      expect(result.current.showActions).toBe(true)
    })

    it("hides actions when canUsePaycode is false", () => {
      const request = { ...basePayCodeRequest, canUsePaycode: false }
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          request as Parameters<typeof useDisplayPaymentRequest>[0],
          false,
          { address: null, failed: false },
        ),
      )

      expect(result.current.showActions).toBe(false)
    })
  })

  describe("onchain", () => {
    it("returns truncated onchain address", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          true,
          { address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", failed: false },
        ),
      )

      expect(mockTruncateMiddle).toHaveBeenCalledWith(
        "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      )
      expect(result.current.displayPaymentRequest).toBeTruthy()
    })

    it("shows actions when onchain address exists", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          true,
          { address: "bc1qtest", failed: false },
        ),
      )

      expect(result.current.showActions).toBe(true)
    })

    it("hides actions when onchain address is null", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          true,
          { address: null, failed: false },
        ),
      )

      expect(result.current.showActions).toBe(false)
    })
  })

  describe("previous value caching", () => {
    it("preserves previous payment request when current becomes null", () => {
      const { result, rerender } = renderHook(
        ({
          request,
          isOnChain,
          addr,
        }: {
          request: Parameters<typeof useDisplayPaymentRequest>[0]
          isOnChain: boolean
          addr: string | null
        }) =>
          useDisplayPaymentRequest(request, isOnChain, { address: addr, failed: false }),
        {
          initialProps: {
            request: baseLightningRequest as Parameters<
              typeof useDisplayPaymentRequest
            >[0],
            isOnChain: false,
            addr: null,
          },
        },
      )

      const firstValue = result.current.displayPaymentRequest

      const emptyRequest: MockRequestState = {
        ...baseLightningRequest,
        info: null,
      }

      rerender({
        request: emptyRequest as Parameters<typeof useDisplayPaymentRequest>[0],
        isOnChain: false,
        addr: null,
      })

      expect(result.current.displayPaymentRequest).toBe(firstValue)
    })

    type RailProps = {
      isOnChain: boolean
      onchain: { address: string | null; failed: boolean }
    }
    const renderOnRails = (initialProps: RailProps) =>
      renderHook(
        ({ isOnChain, onchain }: RailProps) =>
          useDisplayPaymentRequest(
            baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
            isOnChain,
            onchain,
          ),
        { initialProps },
      )

    it("never shows the Lightning request on the on-chain page", () => {
      const { result, rerender } = renderOnRails({
        isOnChain: false,
        onchain: { address: null, failed: false },
      })
      expect(result.current.displayPaymentRequest).toBe("lnbc1...quest")

      rerender({ isOnChain: true, onchain: { address: null, failed: false } })
      expect(result.current.displayPaymentRequest).toBe("")

      rerender({ isOnChain: true, onchain: { address: null, failed: true } })
      expect(result.current.displayPaymentRequest).toBe("")
    })

    it("drops the last on-chain address once a later on-chain load fails", () => {
      const { result, rerender } = renderOnRails({
        isOnChain: true,
        onchain: { address: "bc1qfirstaddress", failed: false },
      })
      expect(result.current.displayPaymentRequest).toBe("bc1qf...dress")

      rerender({ isOnChain: true, onchain: { address: null, failed: false } })
      expect(result.current.displayPaymentRequest).toBe("bc1qf...dress")

      rerender({ isOnChain: true, onchain: { address: null, failed: true } })
      expect(result.current.displayPaymentRequest).toBe("")

      rerender({ isOnChain: true, onchain: { address: null, failed: false } })
      expect(result.current.displayPaymentRequest).toBe("")
    })
  })
})
