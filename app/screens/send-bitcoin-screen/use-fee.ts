import { useState, useEffect } from "react"

import { gql } from "@apollo/client"
import {
  WalletCurrency,
  useLnInvoiceFeeProbeMutation,
  useLnNoAmountInvoiceFeeProbeMutation,
  useLnNoAmountUsdInvoiceFeeProbeMutation,
  useLnUsdInvoiceFeeProbeMutation,
  useOnChainTxFeeLazyQuery,
  useOnChainUsdTxFeeAsBtcDenominatedLazyQuery,
  useOnChainUsdTxFeeLazyQuery,
} from "@app/graphql/generated"
import { WalletAmount } from "@app/types/amounts"
import crashlytics from "@react-native-firebase/crashlytics"

import { GetFee } from "./payment-details/index.types"

type FeeType =
  | {
      status: "loading" | "error" | "unset"
      amount?: undefined | null
    }
  | {
      amount: WalletAmount<WalletCurrency>
      status: "set"
    }
  | {
      amount?: WalletAmount<WalletCurrency>
      status: "error"
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
          })
        }

        return setFee({
          status: "set",
          amount: feeResponse.amount,
        })
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
        }
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
