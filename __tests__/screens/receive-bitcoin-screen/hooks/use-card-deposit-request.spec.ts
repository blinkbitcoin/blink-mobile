import { it } from "@jest/globals"
import { act, renderHook } from "@testing-library/react-native"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
  WalletCurrency,
} from "@app/graphql/generated"
import { useCardDepositRequest } from "@app/screens/receive-bitcoin-screen/hooks/use-card-deposit-request"
import {
  Invoice,
  PaymentRequestState,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { CARD, DisplayCurrency } from "@app/types/amounts"
import { toastShow } from "@app/utils/toast"

type Deposit = {
  destination?: string
  state: PaymentRequestStateType
  status?: CardCollateralDepositIntentStatus
  error?: { code?: string; message: string }
  creditedSats?: number | null
  expiresInSeconds: number | null
  regenerate: () => void
}

const mockRegenerateLightning = jest.fn()
const idleDeposit = (regenerate = jest.fn()): Deposit => ({
  state: PaymentRequestState.Idle,
  expiresInSeconds: null,
  regenerate,
})

const mockDeposits: Record<CardCollateralDepositMethod, Deposit> = {
  [CardCollateralDepositMethod.Lightning]: idleDeposit(mockRegenerateLightning),
  [CardCollateralDepositMethod.Onchain]: idleDeposit(),
}
const mockUseCardDeposit = jest.fn()
jest.mock("@app/screens/receive-bitcoin-screen/hooks/use-card-deposit", () => ({
  useCardDeposit: (params: { method: CardCollateralDepositMethod }) => {
    mockUseCardDeposit(params)
    return mockDeposits[params.method]
  },
}))

const mockConvertMoneyAmount = jest.fn(
  (moneyAmount: { amount: number }, toCurrency: string) => ({
    amount: moneyAmount.amount * 10,
    currency: toCurrency,
    currencyCode: toCurrency,
  }),
)
let mockHasPrice = true
jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockHasPrice ? mockConvertMoneyAmount : undefined,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} SAT`,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        Deposit: {
          note: () => "Card Balance Top-up",
          setAmount: () => "Set an amount",
          crediting: () => "Adding to your Card Balance",
          credited: ({ amount }: { amount: string }) => `${amount} added`,
          failed: () => "Contact support",
          addressFailed: () => "Could not load the address",
        },
        CardBalanceTransfer: {
          tooManyPending: () => "Too many top-ups",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({ toastShow: jest.fn() }))

const TEN_CENTS = { amount: 10, currency: DisplayCurrency, currencyCode: "USD" }

const setDeposit = (method: CardCollateralDepositMethod, deposit: Partial<Deposit>) => {
  mockDeposits[method] = { ...mockDeposits[method], ...deposit }
}

const lastParamsFor = (method: CardCollateralDepositMethod) =>
  mockUseCardDeposit.mock.calls
    .map(([params]) => params)
    .filter((params) => params.method === method)
    .pop()

const renderRequest = () => renderHook(() => useCardDepositRequest())

describe("useCardDepositRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasPrice = true
    mockDeposits[CardCollateralDepositMethod.Lightning] = idleDeposit(
      mockRegenerateLightning,
    )
    mockDeposits[CardCollateralDepositMethod.Onchain] = idleDeposit()
  })

  it("waits for the price, since an amount cannot be counted without it", () => {
    mockHasPrice = false

    const { result } = renderRequest()

    expect(result.current).toBeNull()
  })

  it("pays into the Card Balance, with the note fixed and no wallet to switch to", () => {
    const { result } = renderRequest()

    expect(result.current).toMatchObject({
      destination: CARD,
      type: Invoice.Lightning,
      memoChangeText: "Card Balance Top-up",
      canSetMemo: false,
      canSetAmount: true,
      canUsePaycode: false,
      canSetExpirationTime: false,
      receivingWalletDescriptor: { currency: WalletCurrency.Btc },
    })
  })

  it("asks for an amount and mints nothing until one is set", () => {
    const { result } = renderRequest()

    expect(result.current?.amountPrompt).toBe("Set an amount")
    expect(lastParamsFor(CardCollateralDepositMethod.Lightning)).toEqual({
      method: CardCollateralDepositMethod.Lightning,
      amountSats: 0,
      isRequested: true,
    })
  })

  it("mints the Lightning invoice for the amount in sats, with no minimum", () => {
    const { result } = renderRequest()

    act(() => result.current?.setAmount(TEN_CENTS))

    expect(mockConvertMoneyAmount).toHaveBeenCalledWith(TEN_CENTS, WalletCurrency.Btc)
    expect(lastParamsFor(CardCollateralDepositMethod.Lightning)?.amountSats).toBe(100)
    expect(result.current?.amountPrompt).toBeUndefined()
    expect(result.current?.settlementAmount?.amount).toBe(100)
  })

  it("mints the on-chain address only once its page is opened", () => {
    const { result } = renderRequest()
    act(() => result.current?.setAmount(TEN_CENTS))

    expect(lastParamsFor(CardCollateralDepositMethod.Onchain)?.isRequested).toBe(false)

    act(() => result.current?.requestOnchainAddress?.())

    expect(lastParamsFor(CardCollateralDepositMethod.Onchain)).toEqual({
      method: CardCollateralDepositMethod.Onchain,
      amountSats: 100,
      isRequested: true,
    })
  })

  it("shows the minted invoice, ready to copy and share", () => {
    setDeposit(CardCollateralDepositMethod.Lightning, {
      destination: "lnbc100",
      state: PaymentRequestState.Created,
    })

    const { result } = renderRequest()
    const data = result.current?.info?.data

    expect(result.current?.state).toBe(PaymentRequestState.Created)
    expect(data?.invoiceType).toBe(Invoice.Lightning)
    expect(data?.paymentRequest).toBe("lnbc100")
    expect(data?.getFullUriFn({ uppercase: true })).toBe("LNBC100")
    expect(data?.getCopyableInvoiceFn()).toBe("lnbc100")
    expect(result.current?.pr?.info).toBe(result.current?.info)
  })

  it("shows the minted address as a bitcoin URI for the amount", () => {
    setDeposit(CardCollateralDepositMethod.Onchain, {
      destination: "tb1qcard",
      state: PaymentRequestState.Created,
    })

    const { result } = renderRequest()
    act(() => result.current?.setAmount(TEN_CENTS))

    expect(result.current?.onchainAddress).toBe("tb1qcard")
    expect(result.current?.getOnchainFullUriFn?.({})).toBe(
      "bitcoin:tb1qcard?amount=0.000001",
    )
    expect(result.current?.onchainAddressFailed).toBe(false)
  })

  it("has no address URI before an address is minted", () => {
    const { result } = renderRequest()

    expect(result.current?.getOnchainFullUriFn).toBeUndefined()
  })

  it("reads a refused address as failed", () => {
    setDeposit(CardCollateralDepositMethod.Onchain, { state: PaymentRequestState.Error })

    const { result } = renderRequest()

    expect(result.current?.onchainAddressFailed).toBe(true)
  })

  it("mints a new invoice when the expired one is regenerated", () => {
    const { result } = renderRequest()

    result.current?.regenerateInvoice()

    expect(mockRegenerateLightning).toHaveBeenCalled()
  })

  it("names the wait while a payment that arrived is credited", () => {
    setDeposit(CardCollateralDepositMethod.Lightning, {
      state: PaymentRequestState.Converting,
    })

    const { result } = renderRequest()

    expect(result.current?.state).toBe(PaymentRequestState.Converting)
    expect(result.current?.convertingMessage).toBe("Adding to your Card Balance")
  })

  describe("a payment credited to the Card Balance", () => {
    it.each([CardCollateralDepositMethod.Lightning, CardCollateralDepositMethod.Onchain])(
      "reads as paid when it came by %s, and says the sats it credited",
      (method) => {
        setDeposit(method, { state: PaymentRequestState.Paid, creditedSats: 98 })

        const { result } = renderRequest()

        expect(result.current?.state).toBe(PaymentRequestState.Paid)
        expect(toastShow).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success", message: "98 SAT added" }),
        )
      },
    )

    it("says it once, however often the screen draws again", () => {
      setDeposit(CardCollateralDepositMethod.Lightning, {
        state: PaymentRequestState.Paid,
        creditedSats: 98,
      })

      const { rerender } = renderRequest()
      rerender({})
      rerender({})

      expect(toastShow).toHaveBeenCalledTimes(1)
    })

    it("falls back to the amount asked for when blink-card names no credit", () => {
      const { result, rerender } = renderRequest()
      act(() => result.current?.setAmount(TEN_CENTS))

      setDeposit(CardCollateralDepositMethod.Lightning, {
        state: PaymentRequestState.Paid,
        creditedSats: null,
      })
      rerender({})

      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "100 SAT added" }),
      )
    })
  })

  describe("why the invoice failed", () => {
    it("asks to contact support when blink-card could not credit the payment", () => {
      setDeposit(CardCollateralDepositMethod.Lightning, {
        state: PaymentRequestState.Error,
        status: CardCollateralDepositIntentStatus.Failed,
      })

      const { result } = renderRequest()

      expect(result.current?.errorMessage).toBe("Contact support")
    })

    it("says too many top-ups are waiting when blink-card refuses another", () => {
      setDeposit(CardCollateralDepositMethod.Lightning, {
        state: PaymentRequestState.Error,
        error: { code: "TOO_MANY_PENDING_DEPOSIT_INTENTS", message: "Too many" },
      })

      const { result } = renderRequest()

      expect(result.current?.errorMessage).toBe("Too many top-ups")
    })

    it("leaves any other failure to the screen's own error", () => {
      setDeposit(CardCollateralDepositMethod.Lightning, {
        state: PaymentRequestState.Error,
        error: { code: "SERVICE_UNAVAILABLE", message: "Down" },
      })

      const { result } = renderRequest()

      expect(result.current?.errorMessage).toBeUndefined()
    })
  })

  describe("why the address failed", () => {
    it("says the address could not load, since the card has no New to retry with", () => {
      setDeposit(CardCollateralDepositMethod.Onchain, {
        state: PaymentRequestState.Error,
        error: { code: "SERVICE_UNAVAILABLE", message: "Down" },
      })

      const { result } = renderRequest()

      expect(result.current?.onchainErrorMessage).toBe("Could not load the address")
    })

    it("says too many top-ups are waiting when blink-card refuses another", () => {
      setDeposit(CardCollateralDepositMethod.Onchain, {
        state: PaymentRequestState.Error,
        error: { code: "TOO_MANY_PENDING_DEPOSIT_INTENTS", message: "Too many" },
      })

      const { result } = renderRequest()

      expect(result.current?.onchainErrorMessage).toBe("Too many top-ups")
    })

    it("asks to contact support when blink-card could not credit the payment", () => {
      setDeposit(CardCollateralDepositMethod.Onchain, {
        state: PaymentRequestState.Error,
        status: CardCollateralDepositIntentStatus.Failed,
      })

      const { result } = renderRequest()

      expect(result.current?.onchainErrorMessage).toBe("Contact support")
    })
  })
})
