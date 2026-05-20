import { useCallback, useEffect, useState } from "react"

import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  DepositErrorReason,
  DepositStatus,
  PaymentResultStatus,
  type PendingDeposit,
} from "@app/types/payment.types"
import { toastShow } from "@app/utils/toast"

const DepositActionType = {
  Claim: "claim",
  Refund: "refund",
} as const

type DepositActionType = (typeof DepositActionType)[keyof typeof DepositActionType]

type ActiveAction = {
  depositId: string
  type: DepositActionType
}

type PaymentError = { message: string }
type LL = ReturnType<typeof useI18nContext>["LL"]

const resolveClaimErrorMessage = (
  deposit: PendingDeposit,
  errors: PaymentError[] | undefined,
  LL: LL,
): string => {
  if (deposit.errorReason === DepositErrorReason.BelowDust) {
    return LL.UnclaimedDeposit.belowDustLimit()
  }
  if (deposit.errorReason === DepositErrorReason.FeeExceeded) {
    return LL.UnclaimedDeposit.feeExceeded({
      requiredFee: deposit.requiredFeeSats ?? 0,
    })
  }
  if (deposit.errorReason === DepositErrorReason.MissingUtxo) {
    return LL.UnclaimedDeposit.missingUtxo()
  }
  if (errors?.length) {
    return LL.UnclaimedDeposit.claimFailed({ error: errors[0].message })
  }
  return LL.UnclaimedDeposit.error()
}

const resolveRefundErrorMessage = (
  deposit: PendingDeposit,
  errors: PaymentError[] | undefined,
  LL: LL,
): string => {
  if (deposit.errorReason === DepositErrorReason.BelowDust) {
    return LL.UnclaimedDeposit.belowDustLimit()
  }
  if (deposit.errorReason === DepositErrorReason.FeeExceeded) {
    return LL.UnclaimedDeposit.feeExceeded({
      requiredFee: deposit.requiredFeeSats ?? 0,
    })
  }
  if (errors?.length) {
    return LL.UnclaimedDeposit.refundFailed({ error: errors[0].message })
  }
  return LL.UnclaimedDeposit.error()
}

export const useDepositActions = () => {
  const { LL } = useI18nContext()
  const { listPendingDeposits, claimDeposit } = usePayments()
  const [deposits, setDeposits] = useState<PendingDeposit[]>([])
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null)

  const isBusy = activeAction !== null

  const isProcessing = (depositId: string, type: DepositActionType) =>
    activeAction?.depositId === depositId && activeAction.type === type

  const refresh = useCallback(async () => {
    if (!listPendingDeposits) return
    const result = await listPendingDeposits()
    setDeposits(result.deposits.filter(({ status }) => status !== DepositStatus.Refunded))
  }, [listPendingDeposits])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleClaim = useCallback(
    async (deposit: PendingDeposit) => {
      if (!claimDeposit) {
        toastShow({ message: LL.UnclaimedDeposit.error(), LL })
        return
      }
      setActiveAction({ depositId: deposit.id, type: DepositActionType.Claim })
      try {
        const result = await claimDeposit.claimDeposit({ depositId: deposit.id })
        if (result.status === PaymentResultStatus.Failed) {
          const message = resolveClaimErrorMessage(deposit, result.errors, LL)
          toastShow({ message, LL })
          return
        }
        toastShow({
          message: LL.UnclaimedDeposit.claimSuccess(),
          type: "success",
          LL,
        })
        await refresh()
      } finally {
        setActiveAction(null)
      }
    },
    [claimDeposit, refresh, LL],
  )

  const handleRefund = useCallback(
    async (
      deposit: PendingDeposit,
      destinationAddress: string,
      feeRateSatPerVb: number,
    ) => {
      if (!claimDeposit || !destinationAddress.trim()) return
      if (feeRateSatPerVb <= 0) {
        toastShow({ message: LL.UnclaimedDeposit.feeRateUnavailable(), LL })
        return false
      }
      setActiveAction({ depositId: deposit.id, type: DepositActionType.Refund })
      try {
        const result = await claimDeposit.refundDeposit({
          depositId: deposit.id,
          destinationAddress: destinationAddress.trim(),
          feeRateSatPerVb,
        })
        if (result.status === PaymentResultStatus.Failed) {
          const message = resolveRefundErrorMessage(deposit, result.errors, LL)
          toastShow({ message, LL })
          return false
        }
        toastShow({
          message: LL.UnclaimedDeposit.refundSuccess(),
          type: "success",
          LL,
        })
        await refresh()
        return true
      } finally {
        setActiveAction(null)
      }
    },
    [claimDeposit, refresh, LL],
  )

  return {
    deposits,
    isBusy,
    isProcessing,
    handleClaim,
    handleRefund,
    DepositActionType,
  }
}
