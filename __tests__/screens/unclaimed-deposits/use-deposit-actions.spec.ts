import { act, renderHook, waitFor } from "@testing-library/react-native"

import { useDepositActions } from "@app/screens/unclaimed-deposits/hooks/use-deposit-actions"
import {
  DepositClaimDeferral,
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

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({
    listPendingDeposits: mockListPendingDeposits,
    claimDeposit: {
      claimDeposit: mockClaimDeposit,
      refundDeposit: mockRefundDeposit,
      getClaimFee: mockGetClaimFee,
    },
  }),
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
        claiming: () => "Claiming...",
        immature: () => "Waiting for confirmations...",
        error: () => "Error",
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
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })
    mockRefundDeposit.mockResolvedValue({ status: PaymentResultStatus.Success })
    mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Success })
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
  })

  describe("handleClaim — deferred and in-progress claims (0.26)", () => {
    it("quotes the fee the deferred claim needs now, not the one listed earlier", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "Claim needs 420 sats in fees" }],
        deferral: DepositClaimDeferral.FeeExceeded,
        requiredFeeSats: 420,
      })
      const { result } = renderHook(() => useDepositActions())
      const deposit = buildDeposit({
        errorReason: DepositErrorReason.FeeExceeded,
        requiredFeeSats: 198,
      })

      await act(async () => {
        await result.current.handleClaim(deposit)
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Fee exceeded 420" }),
      )
    })

    it("says the deposit is waiting for confirmations, not that it was claimed", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "Deposit cannot be claimed before it confirms" }],
        deferral: DepositClaimDeferral.AwaitingConfirmations,
      })
      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Waiting for confirmations..." }),
      )
    })

    it("says the deposit is too small when the claim finds it so", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "Deposit is too small to claim after fees" }],
        errorReason: DepositErrorReason.BelowDust,
      })
      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Below dust" }),
      )
    })

    it("shows the provider's reason when it declined the claim", async () => {
      mockClaimDeposit.mockResolvedValue({
        status: PaymentResultStatus.Failed,
        errors: [{ message: "quote expired" }],
        deferral: DepositClaimDeferral.ProviderDeclined,
      })
      const { result } = renderHook(() => useDepositActions())

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Claim failed: quote expired" }),
      )
    })

    it("says a claim already running is in progress, and refreshes the list", async () => {
      mockClaimDeposit.mockResolvedValue({ status: PaymentResultStatus.Pending })
      const { result } = renderHook(() => useDepositActions())
      await waitFor(() => expect(mockListPendingDeposits).toHaveBeenCalledTimes(1))

      await act(async () => {
        await result.current.handleClaim(buildDeposit())
      })

      expect(mockToastShow).toHaveBeenCalledTimes(1)
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Claiming...", type: "warning" }),
      )
      expect(mockListPendingDeposits).toHaveBeenCalledTimes(2)
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
