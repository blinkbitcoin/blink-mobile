import { useState, useEffect } from "react"

import { gql, ApolloError } from "@apollo/client"
import crashlytics from "@react-native-firebase/crashlytics"

import {
  WalletCurrency,
  PayoutSpeed,
  useLnInvoiceFeeProbeMutation,
  useLnNoAmountInvoiceFeeProbeMutation,
  useLnNoAmountUsdInvoiceFeeProbeMutation,
  useLnUsdInvoiceFeeProbeMutation,
  useOnChainTxFeeLazyQuery,
  useOnChainUsdTxFeeAsBtcDenominatedLazyQuery,
  useOnChainUsdTxFeeLazyQuery,
  useOnChainFeeEstimatesPayoutQueueBtcLazyQuery,
  useOnChainFeeEstimatesPayoutQueueUsdLazyQuery,
} from "@app/graphql/generated"
import { WalletAmount } from "@app/types/amounts"

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

type FeeEstimatesType =
  | {
      status: "loading" | "error" | "unset"
      estimates?: undefined | null
      errorMessage?: string
    }
  | {
      estimates: Partial<Record<PayoutSpeed, number>>
      status: "set"
      errorMessage?: string
    }
  | {
      estimates?: Partial<Record<PayoutSpeed, number>>
      status: "error"
      errorMessage?: string
    }

type OnChainFeeEstimatesParams = {
  walletId?: string
  address?: string
  amount?: number
  currency?: WalletCurrency
  skipFast?: boolean
  skipMedium?: boolean
  skipSlow?: boolean
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

  query onChainFeeEstimatesPayoutQueueBtc(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
    $skipFast: Boolean! = false
    $skipMedium: Boolean! = false
    $skipSlow: Boolean! = false
  ) {
    fast: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: FAST
    ) @skip(if: $skipFast) {
      amount
    }
    medium: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: MEDIUM
    ) @skip(if: $skipMedium) {
      amount
    }
    slow: onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: SLOW
    ) @skip(if: $skipSlow) {
      amount
    }
  }

  query onChainFeeEstimatesPayoutQueueUsd(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: CentAmount!
    $skipFast: Boolean! = false
    $skipMedium: Boolean! = false
    $skipSlow: Boolean! = false
  ) {
    fast: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: FAST
    ) @skip(if: $skipFast) {
      amount
    }
    medium: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: MEDIUM
    ) @skip(if: $skipMedium) {
      amount
    }
    slow: onChainUsdTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      speed: SLOW
    ) @skip(if: $skipSlow) {
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

const extractApolloErrorMessage = (error?: ApolloError): string | undefined => {
  if (!error) return undefined
  const gqlMsg = error.graphQLErrors && error.graphQLErrors[0]?.message
  return gqlMsg || error.message
}

export const useOnChainPayoutQueueFeeEstimates = ({
  walletId,
  address,
  amount,
  currency,
  skipFast = false,
  skipMedium = false,
  skipSlow = false,
}: OnChainFeeEstimatesParams): FeeEstimatesType => {
  const [feeEstimates, setFeeEstimates] = useState<FeeEstimatesType>({
    status: "unset",
  })

  const [fetchBtc] = useOnChainFeeEstimatesPayoutQueueBtcLazyQuery({
    fetchPolicy: "no-cache",
  })
  const [fetchUsd] = useOnChainFeeEstimatesPayoutQueueUsdLazyQuery({
    fetchPolicy: "no-cache",
  })

  useEffect(() => {
    if (!walletId || !address || !amount || !currency) {
      return
    }

    const getFeeEstimates = async () => {
      setFeeEstimates({
        status: "loading",
      })

      try {
        const variables = {
          walletId,
          address,
          amount,
          skipFast,
          skipMedium,
          skipSlow,
        }

        const fetchFunction = currency === WalletCurrency.Btc ? fetchBtc : fetchUsd
        const result = await fetchFunction({ variables })

        if (result.error) {
          const msg = extractApolloErrorMessage(result.error)
          return setFeeEstimates({
            status: "error",
            estimates: {},
            errorMessage: msg,
          })
        }

        const estimates = {
          [PayoutSpeed.Fast]: result.data?.fast?.amount,
          [PayoutSpeed.Medium]: result.data?.medium?.amount,
          [PayoutSpeed.Slow]: result.data?.slow?.amount,
        }
        return setFeeEstimates({
          status: "set",
          estimates,
        })
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
        }
        const msg =
          err instanceof ApolloError
            ? extractApolloErrorMessage(err)
            : err instanceof Error
              ? err.message
              : undefined

        return setFeeEstimates({
          status: "error",
          estimates: {},
          errorMessage: msg,
        })
      }
    }

    getFeeEstimates()
  }, [
    walletId,
    address,
    amount,
    currency,
    skipFast,
    skipMedium,
    skipSlow,
    fetchBtc,
    fetchUsd,
  ])

  return feeEstimates
}

export default useFee
