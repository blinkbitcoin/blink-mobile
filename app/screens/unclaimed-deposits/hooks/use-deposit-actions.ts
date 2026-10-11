import { useCallback, useEffect, useState } from "react"

import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useTranslateSdkError } from "@app/self-custodial/hooks"
import {
  DepositErrorReason,
  DepositStatus,
  PaymentResultStatus,
  type PendingDeposit,
} from "@app/types/payment"
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
/** Turns a classified self-custodial code into a sentence, and leaves anything else be. */
type TranslateSdkError = ReturnType<typeof useTranslateSdkError>

type ErrorMessageParams = {
  deposit: PendingDeposit
  errors: PaymentError[] | undefined
  LL: LL
  translateSdkError: TranslateSdkError
}

const resolveClaimErrorMessage = ({
  deposit,
  errors,
  LL,
  translateSdkError,
}: ErrorMessageParams): string => {
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
    return LL.UnclaimedDeposit.claimFailed({
      error: translateSdkError(errors[0].message) ?? errors[0].message,
    })
  }
  return LL.UnclaimedDeposit.error()
}

const resolveRefundErrorMessage = ({
  deposit,
  errors,
  LL,
  translateSdkError,
}: ErrorMessageParams): string => {
  if (deposit.errorReason === DepositErrorReason.BelowDust) {
    return LL.UnclaimedDeposit.belowDustLimit()
  }
  if (deposit.errorReason === DepositErrorReason.FeeExceeded) {
    return LL.UnclaimedDeposit.feeExceeded({
      requiredFee: deposit.requiredFeeSats ?? 0,
    })
  }
  if (errors?.length) {
    return LL.UnclaimedDeposit.refundFailed({
      error: translateSdkError(errors[0].message) ?? errors[0].message,
    })
  }
  return LL.UnclaimedDeposit.error()
}

export const useDepositActions = () => {
  const { LL } = useI18nContext()
  const translateSdkError = useTranslateSdkError()
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
        /**
         * Override the auto-claim cap with the fee the SDK reported as required, so
         * an explicit "Claim now" is not blocked by the same MaxDepositClaimFeeExceeded.
         */
        const result = await claimDeposit.claimDeposit({
          depositId: deposit.id,
          maxFeeSats: deposit.requiredFeeSats,
        })
        if (result.status === PaymentResultStatus.Failed) {
          const message = resolveClaimErrorMessage({
            deposit,
            errors: result.errors,
            LL,
            translateSdkError,
          })
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
    [claimDeposit, refresh, LL, translateSdkError],
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
          const message = resolveRefundErrorMessage({
            deposit,
            errors: result.errors,
            LL,
            translateSdkError,
          })
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
    [claimDeposit, refresh, LL, translateSdkError],
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
