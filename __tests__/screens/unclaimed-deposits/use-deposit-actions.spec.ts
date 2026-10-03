import { act, renderHook, waitFor } from "@testing-library/react-native"

import { useDepositActions } from "@app/screens/unclaimed-deposits/hooks/use-deposit-actions"
import {
  DepositErrorReason,
  DepositStatus,
  PaymentResultStatus,
  type PendingDeposit,
} from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockListPendingDeposits = jest.fn()
const mockClaimDeposit = jest.fn()
const mockRefundDeposit = jest.fn()
const mockGetClaimFee = jest.fn()
const mockToastShow = jest.fn()

/** Held in a mock so one test can take the wallet away and see what the hook does. */
const mockUsePayments = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => mockUsePayments(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      UnclaimedDeposit: {
        feeRateUnavailable: () => "Couldn't load network fees",
        refundFailed: ({ error }: { error: string }) => `Refund failed: ${error}`,
        refundSuccess: () => "Refund initiated successfully",
        belowDustLimit: () => "Below dust",
        feeExceeded: ({ requiredFee }: { requiredFee: number }) =>
          `Fee exceeded ${requiredFee}`,
        missingUtxo: () => "Missing UTXO",
        claimFailed: ({ error }: { error: string }) => `Claim failed: ${error}`,
        claimSuccess: () => "Deposit claimed",
        error: () => "Error",
      },
      /** The real translator reads these, so the hook renders sentences, not codes. */
      SelfCustodialError: {
        insufficientFunds: () => "Not enough funds",
        belowMinimum: () => "Below the minimum",
        networkError: () => "Network connection problem",
        invalidInput: () => "The payment details look invalid",
        generic: () => "Something went wrong. Please try again.",
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const buildDeposit = (overrides: Partial<PendingDeposit> = {}): PendingDeposit => ({
  id: "deposit-1",
  txid: "abc",
  vout: 0,
  amount: { amount: 10000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Claimable,
  errorReason: null,
  ...overrides,
})

describe("useDepositActions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePayments.mockReturnValue({
      listPendingDeposits: mockListPendingDeposits,
      claimDeposit: {
        claimDeposit: mockClaimDeposit,
        refundDeposit: mockRefundDeposit,
        getClaimFee: mockGetClaimFee,
      },
    })
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })
    mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Success })
    mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Success })
  })

  describe("without a connected wallet", () => {
    beforeEach(() => {
      mockUsePayments.mockReturnValue({
        listPendingDeposits: undefined,
        claimDeposit: undefined,
      })
    })

    it("says so instead of claiming into nothing", async () => {
      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Error" }),
      )
      expect(mockClaimDeposit).not.toHaveBeenCalled()
    })

    it("holds an empty list rather than reading one it cannot read", async () => {
      const { result } = renderHook(() => useDepositActions())
      await act(async () => {})

      expect(result.current.deposits).toEqual([])
      expect(mockListPendingDeposits).not.toHaveBeenCalled()
    })

    it("does not attempt a refund", async () => {
      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(buildDeposit(), "bc1qaddr", 3)
      })

      expect(mockRefundDeposit).not.toHaveBeenCalled()
    })
  })

  describe("handleRefund — fee rate validation", () => {
    it("rejects when feeRateSatPerVb is 0 (regression)", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      let returned: boolean | undefined
      await act(async () => {
        returned = await result.current.handleRefund(deposit, "bc1qaddr", 0)
      })

      expect(returned).toBe(false)
      expect(mockRefundDeposit).not.toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Couldn't load network fees" }),
      )
    })

    it("rejects when feeRateSatPerVb is negative", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      let returned: boolean | undefined
      await act(async () => {
        returned = await result.current.handleRefund(deposit, "bc1qaddr", -1)
      })

      expect(returned).toBe(false)
      expect(mockRefundDeposit).not.toHaveBeenCalled()
    })

    it("does not reach SDK when address is empty", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      await act(async () => {
        await result.current.handleRefund(deposit, "   ", 5)
      })

      expect(mockRefundDeposit).not.toHaveBeenCalled()
    })

    it("forwards positive fee rate and trimmed address to SDK", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      await act(async () => {
        await result.current.handleRefund(deposit, "  bc1qaddr  ", 12)
      })

      expect(mockRefundDeposit).toHaveBeenCalledWith({
        depositId: "deposit-1",
        destinationAddress: "bc1qaddr",
        feeRateSatPerVb: 12,
      })
    })

    it("explains a refund refused because the deposit is below dust", async () => {
      mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(
          buildDeposit({ errorReason: DepositErrorReason.BelowDust }),
          "bc1qaddr",
          5,
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Below dust" }),
      )
    })

    it("explains a refund refused because the network fee is too high", async () => {
      mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(
          buildDeposit({
            errorReason: DepositErrorReason.FeeExceeded,
            requiredFeeSats: 420,
          }),
          "bc1qaddr",
          5,
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Fee exceeded 420" }),
      )
    })

    it("names a zero fee when a refund refusal carries no figure", async () => {
      mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(
          buildDeposit({ errorReason: DepositErrorReason.FeeExceeded }),
          "bc1qaddr",
          5,
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Fee exceeded 0" }),
      )
    })

    it("keeps an empty refund failure message empty", async () => {
      mockRefundDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "" }],
      })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(buildDeposit(), "bc1qaddr", 5)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Refund failed: " }),
      )
    })

    it("falls back to a plain error when a refund failure says nothing at all", async () => {
      mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleRefund(buildDeposit(), "bc1qaddr", 5)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Error" }),
      )
    })

    it("surfaces SDK refund failure as a toast", async () => {
      mockRefundDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "rejected" }],
      })

      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit({ errorReason: DepositErrorReason.Generic })

      let returned: boolean | undefined
      await act(async () => {
        returned = await result.current.handleRefund(deposit, "bc1qaddr", 5)
      })

      expect(returned).toBe(false)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Refund failed: rejected" }),
      )
    })

    it("toasts success and returns true when SDK accepts", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      let returned: boolean | undefined
      await act(async () => {
        returned = await result.current.handleRefund(deposit, "bc1qaddr", 5)
      })

      expect(returned).toBe(true)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Refund initiated successfully",
          type: "success",
        }),
      )
    })
  })

  describe("handleClaim — max fee override", () => {
    it("overrides the auto-claim cap with the SDK-reported required fee", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit({
        errorReason: DepositErrorReason.FeeExceeded,
        requiredFeeSats: 198,
      })

      await act(async () => {
        await result.current.handleClaim(deposit)
      })

      expect(mockClaimDeposit).toHaveBeenCalledWith({
        depositId: "deposit-1",
        maxFeeSats: 198,
      })
    })

    it("claims without a fee override when no required fee is known", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      await act(async () => {
        await result.current.handleClaim(deposit)
      })

      expect(mockClaimDeposit).toHaveBeenCalledWith({
        depositId: "deposit-1",
        maxFeeSats: undefined,
      })
    })

    it("toasts success when the claim is accepted", async () => {
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      await act(async () => {
        await result.current.handleClaim(deposit)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Deposit claimed", type: "success" }),
      )
    })

    it("surfaces the required-fee message when the claim still exceeds the cap", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "MaxDepositClaimFeeExceeded" }],
      })

      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit({
        errorReason: DepositErrorReason.FeeExceeded,
        requiredFeeSats: 198,
      })

      await act(async () => {
        await result.current.handleClaim(deposit)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Fee exceeded 198" }),
      )
    })

    it("tells the reader what happened rather than repeating the SDK's code", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "sc_generic" }],
      })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Claim failed: Something went wrong. Please try again.",
        }),
      )
    })

    it("explains a deposit too small to claim", async () => {
      mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(
          buildDeposit({ errorReason: DepositErrorReason.BelowDust }),
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Below dust" }),
      )
    })

    it("explains a deposit the network no longer holds", async () => {
      mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(
          buildDeposit({ errorReason: DepositErrorReason.MissingUtxo }),
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Missing UTXO" }),
      )
    })

    it("names a zero fee when the SDK reported no figure with its refusal", async () => {
      mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(
          buildDeposit({ errorReason: DepositErrorReason.FeeExceeded }),
        )
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Fee exceeded 0" }),
      )
    })

    it("keeps an empty failure message empty rather than inventing one", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "" }],
      })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Claim failed: " }),
      )
    })

    it("falls back to a plain error when the failure says nothing at all", async () => {
      mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Failed })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Error" }),
      )
    })

    it("marks the deposit as processing while its claim is in flight", async () => {
      let settleClaim: (value: unknown) => void = () => {}
      mockClaimDeposit.mockReturnValue(
        new Promise((resolve) => {
          settleClaim = resolve
        }),
      )

      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit()

      act(() => {
        result.current.handleClaim(deposit)
      })

      await waitFor(() => expect(result.current.isBusy).toBe(true))
      expect(result.current.isProcessing(deposit.id, "claim")).toBe(true)
      expect(result.current.isProcessing("another-deposit", "claim")).toBe(false)

      await act(async () => {
        settleClaim({ status: PaymentResultStatus.Success })
      })
    })

    it("leaves a message that is not a classified code exactly as it came", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "Invalid depositId: garbage" }],
      })

      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Claim failed: Invalid depositId: garbage" }),
      )
    })
  })

  describe("refresh", () => {
    it("filters out refunded deposits", async () => {
      mockListPendingDeposits.mockResolvedValue({
        deposits: [
          buildDeposit({ id: "1", status: DepositStatus.Claimable }),
          buildDeposit({ id: "2", status: DepositStatus.Refunded }),
        ],
      })

      const { result } = renderHook(() => useDepositActions())

      await waitFor(() => expect(result.current.deposits).toHaveLength(1))
      expect(result.current.deposits[0].id).toBe("1")
    })
  })
})
