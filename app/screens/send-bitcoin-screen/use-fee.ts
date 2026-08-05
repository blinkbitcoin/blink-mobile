import { useState, useEffect } from "react"

import { gql } from "@apollo/client"
import {
  GraphQlApplicationError,
  WalletCurrency,
  useLnInvoiceFeeProbeMutation,
  useLnNoAmountInvoiceFeeProbeMutation,
  useLnNoAmountUsdInvoiceFeeProbeMutation,
  useLnUsdInvoiceFeeProbeMutation,
  useOnChainTxFeeLazyQuery,
  useOnChainUsdTxFeeAsBtcDenominatedLazyQuery,
  useOnChainUsdTxFeeLazyQuery,
} from "@app/graphql/generated"
import type { SelfCustodialFeeResult } from "@app/self-custodial/payment-details/send-helpers"
import { WalletAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

import { GetFee } from "./payment-details/index.types"

type FeeType =
  | {
      status: "loading" | "unset"
      amount?: undefined | null
    }
  | {
      amount: WalletAmount<WalletCurrency>
      status: "set"
      amountAdjustment?: ConvertAmountAdjustment
    }
  // The only arm that carries errors: a quote that failed, with the classified reason.
  // `null` because GetFee may report a failure alongside an absent amount.
  | {
      amount?: WalletAmount<WalletCurrency> | null
      status: "error"
      errors?: readonly GraphQlApplicationError[]
    }

gql`
  mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {
    lnNoAmountInvoiceFeeProbe(input: $input) {
      errors {
        message
      }
      amount
    }
  }

  mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {
    lnInvoiceFeeProbe(input: $input) {
      errors {
        message
      }
      amount
    }
  }

  mutation lnUsdInvoiceFeeProbe($input: LnUsdInvoiceFeeProbeInput!) {
    lnUsdInvoiceFeeProbe(input: $input) {
      errors {
        message
      }
      amount
    }
  }

  mutation lnNoAmountUsdInvoiceFeeProbe($input: LnNoAmountUsdInvoiceFeeProbeInput!) {
    lnNoAmountUsdInvoiceFeeProbe(input: $input) {
      errors {
        message
      }
      amount
    }
  }

  query onChainTxFee(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
    $speed: PayoutSpeed!
  ) {
    onChainTxFee(walletId: $walletId, address: $address, amount: $amount, speed: $speed) {
      amount
    }
  }

  query onChainUsdTxFee(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: CentAmount!
    $speed: PayoutSpeed!
  ) {
    onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: $speed
    ) {
      amount
    }
  }

  query onChainUsdTxFeeAsBtcDenominated(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
    $speed: PayoutSpeed!
  ) {
    onChainUsdTxFeeAsBtcDenominated(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: $speed
    ) {
      amount
    }
  }
`

const useFee = <T extends WalletCurrency>(getFeeFn?: GetFee<T> | null): FeeType => {
  const [fee, setFee] = useState<FeeType>({
    status: "unset",
  })

  const [lnInvoiceFeeProbe] = useLnInvoiceFeeProbeMutation()
  const [lnNoAmountInvoiceFeeProbe] = useLnNoAmountInvoiceFeeProbeMutation()
  const [lnUsdInvoiceFeeProbe] = useLnUsdInvoiceFeeProbeMutation()
  const [lnNoAmountUsdInvoiceFeeProbe] = useLnNoAmountUsdInvoiceFeeProbeMutation()
  const [onChainTxFee] = useOnChainTxFeeLazyQuery()
  const [onChainUsdTxFee] = useOnChainUsdTxFeeLazyQuery()
  const [onChainUsdTxFeeAsBtcDenominated] = useOnChainUsdTxFeeAsBtcDenominatedLazyQuery()

  useEffect(() => {
    if (!getFeeFn) {
      return
    }

    const getFee = async () => {
      setFee({
        status: "loading",
      })

      try {
        const feeResponse = await getFeeFn({
          lnInvoiceFeeProbe,
          lnNoAmountInvoiceFeeProbe,
          lnUsdInvoiceFeeProbe,
          lnNoAmountUsdInvoiceFeeProbe,
          onChainTxFee,
          onChainUsdTxFee,
          onChainUsdTxFeeAsBtcDenominated,
        })

        if (feeResponse.errors?.length || !feeResponse.amount) {
          return setFee({
            status: "error",
            amount: feeResponse.amount,
            errors: feeResponse.errors,
          })
        }

        const { amountAdjustment } = feeResponse as SelfCustodialFeeResult<T>
        return setFee({
          status: "set",
          amount: feeResponse.amount,
          amountAdjustment,
        })
      } catch (err) {
        reportError("use-fee", err)
        return setFee({
          status: "error",
        })
      }
    }

    getFee()
  }, [
    getFeeFn,
    setFee,
    lnInvoiceFeeProbe,
    lnNoAmountInvoiceFeeProbe,
    lnUsdInvoiceFeeProbe,
    lnNoAmountUsdInvoiceFeeProbe,
    onChainTxFee,
    onChainUsdTxFee,
    onChainUsdTxFeeAsBtcDenominated,
  ])

  return fee
}

export default useFee
