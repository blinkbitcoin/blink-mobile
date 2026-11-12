import React from "react"
import { act, render } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  AmountEntryErrorSheet,
  LnurlInvoiceError,
} from "@app/screens/send-bitcoin-screen/amount-entry/amount-entry-error-sheet"

type SheetProps = {
  isVisible: boolean
  onClose: () => void
  title: string
  body: string
  primaryLabel: string
  onPrimaryPress: () => void
}

/** What the sheet was last asked to show; its own behaviour has a spec of its own. */
let mockSheet: SheetProps
jest.mock("@app/components/error-msg-bottom-sheet", () => ({
  ErrorMsgBottomSheet: (props: SheetProps) => {
    mockSheet = props
    return null
  },
}))

const mockStartOver = jest.fn()
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-review-exits", () => ({
  useReviewExits: () => ({ startOver: mockStartOver }),
}))

loadLocale("en")
const LL = i18nObject("en")

type Props = React.ComponentProps<typeof AmountEntryErrorSheet>

const noErrors: Props = {
  lnurlError: undefined,
  limitMessage: undefined,
  selfPaymentMessage: undefined,
  onRetryLimits: undefined,
  onRetry: undefined,
  onChangeAmount: jest.fn(),
}

const renderSheet = (props: Partial<Props> = {}) => {
  const ui = (next: Partial<Props>) => (
    <TypesafeI18n locale="en">
      <AmountEntryErrorSheet {...noErrors} {...next} />
    </TypesafeI18n>
  )
  const { rerender } = render(ui(props))
  return { rerender: (next: Partial<Props>) => rerender(ui(next)) }
}

const press = () => act(() => mockSheet.onPrimaryPress())

const unreachable: LnurlInvoiceError = {
  title: "Couldn't reach the recipient",
  message: "Their wallet did not answer.",
  canRetry: true,
}

describe("AmountEntryErrorSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays hidden while nothing has failed", () => {
    renderSheet()

    expect(mockSheet.isVisible).toBe(false)
  })

  describe("over the daily limit (A3)", () => {
    const limitMessage = "You can send up to $100.00 today."

    it("opens on its own with Change amount", () => {
      renderSheet({ limitMessage })

      expect(mockSheet).toMatchObject({
        isVisible: true,
        title: LL.SendBitcoinScreen.problemSheetTitle(),
        body: limitMessage,
        primaryLabel: LL.SendBitcoinConfirmationScreen.changeAmount(),
      })
    })

    it("closes and empties the amount on Change amount", () => {
      const onChangeAmount = jest.fn()
      renderSheet({ limitMessage, onChangeAmount })

      press()

      expect(onChangeAmount).toHaveBeenCalledTimes(1)
      expect(mockSheet.isVisible).toBe(false)
    })

    it("stays closed while the amount stays over, and opens again on the next crossing", () => {
      const { rerender } = renderSheet({ limitMessage })
      act(() => mockSheet.onClose())

      rerender({ limitMessage })
      expect(mockSheet.isVisible).toBe(false)

      rerender({ limitMessage: undefined })
      rerender({ limitMessage })
      expect(mockSheet.isVisible).toBe(true)
    })
  })

  describe("an invoice request that failed on Next (L1–L3)", () => {
    it("shows the request's own title and message", () => {
      renderSheet({ lnurlError: unreachable, onRetry: jest.fn() })

      expect(mockSheet).toMatchObject({
        isVisible: true,
        title: unreachable.title,
        body: unreachable.message,
      })
    })

    it("repeats Next on Try again when retrying is safe", () => {
      const onRetry = jest.fn()
      renderSheet({ lnurlError: unreachable, onRetry })

      expect(mockSheet.primaryLabel).toBe(LL.SendBitcoinConfirmationScreen.tryAgain())
      press()

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(mockSheet.isVisible).toBe(false)
    })

    it("offers only Close when retrying is unsafe", () => {
      const onRetry = jest.fn()
      renderSheet({ lnurlError: { ...unreachable, canRetry: false }, onRetry })

      expect(mockSheet.primaryLabel).toBe(LL.common.close())
      press()

      expect(onRetry).not.toHaveBeenCalled()
      expect(mockSheet.isVisible).toBe(false)
    })

    it("offers only Close when the screen has no retry to give", () => {
      renderSheet({ lnurlError: unreachable })

      expect(mockSheet.primaryLabel).toBe(LL.common.close())
    })
  })

  describe("a daily limit that could not be read", () => {
    it("says so and reads it again on Try again", () => {
      const onRetryLimits = jest.fn()
      renderSheet({ onRetryLimits })

      expect(mockSheet).toMatchObject({
        isVisible: true,
        body: LL.SendBitcoinScreen.limitsUnavailable(),
        primaryLabel: LL.SendBitcoinConfirmationScreen.tryAgain(),
      })
      press()

      expect(onRetryLimits).toHaveBeenCalledTimes(1)
      expect(mockSheet.isVisible).toBe(false)
    })
  })

  describe("an on-chain address of the sending wallet (#4261)", () => {
    const selfPaymentMessage = "This address belongs to this wallet."

    it("starts the send over on Change destination", () => {
      renderSheet({ selfPaymentMessage })

      expect(mockSheet.primaryLabel).toBe(LL.SendBitcoinScreen.changeDestination())
      press()

      expect(mockStartOver).toHaveBeenCalledTimes(1)
      expect(mockSheet.isVisible).toBe(false)
    })

    it("stays closed when only the amount changes", () => {
      const { rerender } = renderSheet({ selfPaymentMessage })
      act(() => mockSheet.onClose())

      rerender({ selfPaymentMessage, onChangeAmount: jest.fn() })

      expect(mockSheet.isVisible).toBe(false)
    })
  })

  describe("several errors at once", () => {
    const everything: Partial<Props> = {
      lnurlError: unreachable,
      onRetry: jest.fn(),
      onRetryLimits: jest.fn(),
      limitMessage: "Over the limit",
      selfPaymentMessage: "Your own address",
    }

    it("leads with the failed invoice request", () => {
      renderSheet(everything)

      expect(mockSheet.body).toBe(unreachable.message)
    })

    it("then the unread limit, then the limit, then the address", () => {
      const { rerender } = renderSheet({ ...everything, lnurlError: undefined })
      expect(mockSheet.body).toBe(LL.SendBitcoinScreen.limitsUnavailable())

      rerender({ ...everything, lnurlError: undefined, onRetryLimits: undefined })
      expect(mockSheet.body).toBe("Over the limit")

      rerender({ selfPaymentMessage: "Your own address" })
      expect(mockSheet.body).toBe("Your own address")
    })
  })
})
