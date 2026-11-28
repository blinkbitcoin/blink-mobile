import { renderHook, act } from "@testing-library/react-hooks"
import { Share } from "react-native"

import { usePaymentActions } from "@app/screens/receive-bitcoin-screen/hooks/use-payment-actions"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { haptics } from "@app/utils/haptics"

jest.mock("@app/utils/haptics", () => ({ haptics: { select: jest.fn() } }))

const mockNotifyModal = jest.fn()
jest.mock("@app/components/notifications", () => ({
  ...jest.requireActual("@app/components/notifications"),
  useNotifications: () => ({ notifyModal: mockNotifyModal }),
}))

const mockLL = {
  Messages: {
    shareFailedTitle: () => "Couldn't open sharing",
    shareCopyFailedBody: () => "Copy it and paste it where you need it.",
    copy: () => "Copy",
  },
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
  log: jest.fn(),
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
      expect(haptics.select).not.toHaveBeenCalled()
    })

    it("fires the select haptic once per copy, with the toast", () => {
      const order: string[] = []
      jest.mocked(haptics.select).mockImplementationOnce(() => order.push("haptic"))
      mockToastShow.mockImplementationOnce(() => order.push("toast"))
      const { result } = renderHook(() =>
        usePaymentActions({
          copyableContent: "lnbc1invoice",
          invoiceType: Invoice.Lightning,
        }),
      )

      act(() => {
        result.current.copyToClipboard()
      })

      expect(haptics.select).toHaveBeenCalledTimes(1)
      expect(order).toEqual(["haptic", "toast"])
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

    it("records error on share failure, and offers to copy instead", async () => {
      const error = new Error("Share failed")
      jest.spyOn(Share, "share").mockRejectedValue(error)

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
      const message = mockNotifyModal.mock.lastCall?.[0]
      expect(message).toMatchObject({
        icon: "warning-circle",
        title: "Couldn't open sharing",
        text: "Copy it and paste it where you need it.",
        primaryButtonTitle: "Copy",
      })

      act(() => message.primaryButtonAction())

      expect(mockSetString).toHaveBeenCalledWith("lnbc1invoice")
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
