import { renderHook, act } from "@testing-library/react-hooks"
import { Share, Alert } from "react-native"

import { usePaymentActions } from "@app/screens/receive-bitcoin-screen/hooks/use-payment-actions"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"

const mockLL = {
  ReceiveScreen: {
    copyClipboard: jest.fn(() => "Copied lightning invoice"),
    copyClipboardBitcoin: jest.fn(() => "Copied bitcoin address"),
    copyClipboardPaycode: jest.fn(() => "Copied paycode"),
  },
}

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: ReadonlyArray<Record<string, unknown>>) => mockToastShow(...args),
}))

const mockSetString = jest.fn()
jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: (...args: ReadonlyArray<string>) => mockSetString(...args),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: ReadonlyArray<Error>) => mockRecordError(...args),
}))

describe("usePaymentActions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("copyToClipboard", () => {
    it("does nothing when copyableContent is undefined", () => {
      const { result } = renderHook(() =>
        usePaymentActions({ copyableContent: undefined, invoiceType: Invoice.Lightning }),
      )

      act(() => {
        result.current.copyToClipboard()
      })

      expect(mockSetString).not.toHaveBeenCalled()
      expect(mockToastShow).not.toHaveBeenCalled()
    })

    it("copies content and shows lightning toast", () => {
      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "lnbc1invoice",
          invoiceType: Invoice.Lightning,
        }),
      )

      act(() => {
        result.current.copyToClipboard()
      })

      expect(mockSetString).toHaveBeenCalledWith("lnbc1invoice")
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          LL: mockLL,
        }),
      )
    })

    it("copies content and shows onchain toast", () => {
      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "bc1qtest",
          invoiceType: Invoice.OnChain,
        }),
      )

      act(() => {
        result.current.copyToClipboard()
      })

      expect(mockSetString).toHaveBeenCalledWith("bc1qtest")
      expect(mockToastShow).toHaveBeenCalled()
    })

    it("copies content and shows paycode toast", () => {
      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "user@blink.sv",
          invoiceType: Invoice.PayCode,
        }),
      )

      act(() => {
        result.current.copyToClipboard()
      })

      expect(mockSetString).toHaveBeenCalledWith("user@blink.sv")
      expect(mockToastShow).toHaveBeenCalled()
    })
  })

  describe("share", () => {
    it("does nothing when copyableContent is undefined", async () => {
      const shareSpy = jest.spyOn(Share, "share")
      const { result } = renderHook(() =>
        usePaymentActions({ copyableContent: undefined, invoiceType: Invoice.Lightning }),
      )

      await act(async () => {
        await result.current.share()
      })

      expect(shareSpy).not.toHaveBeenCalled()
    })

    it("shares content via Share API", async () => {
      const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
        action: Share.sharedAction,
        activityType: undefined,
      })

      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "lnbc1invoice",
          invoiceType: Invoice.Lightning,
        }),
      )

      await act(async () => {
        await result.current.share()
      })

      expect(shareSpy).toHaveBeenCalledWith({ message: "lnbc1invoice" })
    })

    it("records error on share failure", async () => {
      const error = new Error("Share failed")
      jest.spyOn(Share, "share").mockRejectedValue(error)
      const alertSpy = jest.spyOn(Alert, "alert")

      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "lnbc1invoice",
          invoiceType: Invoice.Lightning,
        }),
      )

      await act(async () => {
        await result.current.share()
      })

      expect(mockRecordError).toHaveBeenCalledWith(error)
      expect(alertSpy).toHaveBeenCalledWith("Share failed")
    })

    it("ignores non-Error rejection", async () => {
      jest.spyOn(Share, "share").mockRejectedValue("string error")

      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "lnbc1invoice",
          invoiceType: Invoice.Lightning,
        }),
      )

      await act(async () => {
        await result.current.share()
      })

      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })
})
