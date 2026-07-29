import { useState } from "react"
import { recordAppError } from "@app/utils/error-reporting"

import {
  HomeAuthedDocument,
  PaymentSendResult,
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  WalletCurrency,
} from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { WalletDescriptor } from "@app/types/wallets"
import { logConversionAttempt, logConversionResult } from "@app/utils/analytics"
import { triggerHapticFeedback } from "@app/utils/helper"

type ConversionRequest = {
  fromWallet: WalletDescriptor<WalletCurrency>
  toWallet: WalletDescriptor<WalletCurrency>
  fromAmount: number
}

export type IntraLedgerConversion = {
  execute: (request: ConversionRequest) => Promise<void>
  loading: boolean
  errorMessage?: string
}

/** Shared intraledger conversion between the user's own wallets (convert modal + confirmation screen). */
export const useIntraLedgerConversion = ({
  onSuccess,
}: {
  onSuccess: () => void
}): IntraLedgerConversion => {
  const { LL } = useI18nContext()
  const guard = useInFlightGuard()
  const [intraLedgerPaymentSend, { loading: btcLoading }] =
    useIntraLedgerPaymentSendMutation()
  const [intraLedgerUsdPaymentSend, { loading: usdLoading }] =
    useIntraLedgerUsdPaymentSendMutation()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const sendIntraLedger = async ({
    fromWallet,
    toWallet,
    fromAmount,
  }: ConversionRequest) => {
    const input = {
      walletId: fromWallet.id,
      recipientWalletId: toWallet.id,
      amount: fromAmount,
    }

    if (fromWallet.currency === WalletCurrency.Btc) {
      const { data, errors } = await intraLedgerPaymentSend({
        variables: { input },
        refetchQueries: [HomeAuthedDocument],
      })
      const payload = data?.intraLedgerPaymentSend
      return {
        status: payload?.status,
        failure: errors?.length ? getErrorMessages(errors) : payload?.errors[0]?.message,
      }
    }

    const { data, errors } = await intraLedgerUsdPaymentSend({
      variables: { input },
      refetchQueries: [HomeAuthedDocument],
    })
    const payload = data?.intraLedgerUsdPaymentSend
    return {
      status: payload?.status,
      failure: errors?.length ? getErrorMessages(errors) : payload?.errors[0]?.message,
    }
  }

  const execute = async (request: ConversionRequest) => {
    await guard.run(async () => {
      setErrorMessage(undefined)

      const { fromWallet, toWallet } = request

      try {
        logConversionAttempt({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
        })

        const { status, failure } = await sendIntraLedger(request)

        if (!status) {
          recordAppError(new Error("Conversion failed"))
          setErrorMessage(LL.common.error())
          triggerHapticFeedback("notificationError")
          return
        }

        logConversionResult({
          sendingWallet: fromWallet.currency,
          receivingWallet: toWallet.currency,
          paymentStatus: status,
        })

        if (status === PaymentSendResult.Success) {
          triggerHapticFeedback("notificationSuccess")
          onSuccess()
          return
        }

        setErrorMessage(failure ?? LL.common.error())
        triggerHapticFeedback("notificationError")
      } catch (err) {
        if (err instanceof Error) {
          recordAppError(err)
          setErrorMessage(err.message)
          triggerHapticFeedback("notificationError")
        }
      }
    })
  }

  return { execute, loading: btcLoading || usdLoading, errorMessage }
}
