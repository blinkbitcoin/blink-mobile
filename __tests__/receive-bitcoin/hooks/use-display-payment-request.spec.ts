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
          null,
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
          null,
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
          null,
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
          null,
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
          null,
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
          "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
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
          "bc1qtest",
        ),
      )

      expect(result.current.showActions).toBe(true)
    })

    it("hides actions when onchain address is null", () => {
      const { result } = renderHook(() =>
        useDisplayPaymentRequest(
          baseLightningRequest as Parameters<typeof useDisplayPaymentRequest>[0],
          true,
          null,
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
        }) => useDisplayPaymentRequest(request, isOnChain, addr),
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
  })
})
