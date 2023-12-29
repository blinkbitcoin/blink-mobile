import { useState, useEffect } from "react"
import { gql, useApolloClient, useMutation } from "@apollo/client"

import { useMySubscription } from "../../hooks/user-hooks"

export const LIGHTNING_FEES = gql`
  mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {
    lnInvoiceFeeProbe(input: $input) {
      errors {
        message
      }

      amount
    }
  }
`

const NO_AMOUNT_LIGHTNING_FEES = gql`
  mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {
    lnNoAmountInvoiceFeeProbe(input: $input) {
      errors {
        message
      }

      amount
    }
  }
`

const ONCHAIN_FEES = gql`
  query onChainTxFee(
    $walletId: WalletId!
    $address: OnChainAddress!
    $amount: SatAmount!
    $targetConfirmations: TargetConfirmations
  ) {
    onChainTxFee(
      walletId: $walletId
      address: $address
      amount: $amount
      targetConfirmations: $targetConfirmations
    ) {
      amount
      targetConfirmations
    }
  }
`

type FeeType = {
  value: number | null
  status: "loading" | "error" | "unset" | "set"
}

type UseFeeInput = {
  walletId: string
  address: string
  amountless: boolean
  invoice: string
  paymentType: string
  sameNode: boolean
  paymentSatAmount: number
  primaryCurrency: CurrencyType
  targetConfirmations: number
}

type UseFeeReturn = {
  value: number | null
  status: "loading" | "error" | "unset" | "set"
  text: string
}

const useFee = ({
  walletId,
  address,
  amountless,
  invoice,
  paymentType,
  sameNode,
  paymentSatAmount,
  primaryCurrency,
  targetConfirmations = 1,
}: UseFeeInput): UseFeeReturn => {
  const client = useApolloClient()
  const { formatCurrencyAmount } = useMySubscription()

  const [fee, setFee] = useState<FeeType>({
    value: null,
    status: "unset",
  })

  useEffect(() => {
    setFee({
      value: null,
      status: "unset",
    })
  }, [targetConfirmations])


  const [getLightningFees] = useMutation(LIGHTNING_FEES)
  const [getNoAmountLightningFees] = useMutation(NO_AMOUNT_LIGHTNING_FEES)

  if (!walletId) {
    return { ...fee, text: "" }
  }

  if (fee.status !== "unset") {
    if (
      fee.status === "loading" ||
      fee.status === "error" ||
      (fee.value === null && paymentType !== "username")
    ) {
      return { ...fee, text: "" }
    }

    return {
      ...fee,
      text: formatCurrencyAmount({ sats: fee.value ?? 0, currency: primaryCurrency }),
    }
  }

  const initializeFee = async () => {
    if (paymentType == "lightning" || paymentType == "lnurl") {
      if (sameNode) {
        return setFee({
          value: 0,
          status: "set",
        })
      }

      if (amountless && paymentSatAmount === 0) {
        return setFee({
          value: null,
          status: "set",
        })
      }

      try {
        setFee({
          value: null,
          status: "loading",
        })

        let feeValue: number
        if (amountless) {
          const { data } = await getNoAmountLightningFees({
            variables: {
              input: { walletId, paymentRequest: invoice, amount: paymentSatAmount },
            },
          })

          feeValue = data.lnNoAmountInvoiceFeeProbe.amount
        } else {
          const { data } = await getLightningFees({
            variables: { input: { walletId, paymentRequest: invoice } },
          })

          feeValue = data.lnInvoiceFeeProbe.amount
        }

        setFee({
          value: feeValue,
          status: "set",
        })
      } catch (err) {
        console.warn({ err, message: "error getting lightning fees" })
        setFee({
          value: null,
          status: "error",
        })
      }
      return
    }

    if (paymentType === "onchain") {
      if (paymentSatAmount === 0) {
        return setFee({
          value: null,
          status: "set",
        })
      }

      try {
        setFee({
          value: null,
          status: "loading",
        })

        const { data } = await client.query({
          query: ONCHAIN_FEES,
          variables: { walletId, address, amount: paymentSatAmount, targetConfirmations },
          fetchPolicy: "no-cache",
        })
        const feeValue = data.onChainTxFee.amount

        setFee({
          value: feeValue,
          status: "set",
        })
      } catch (err) {
        console.warn({ err, message: "error getting onchains fees" })
        setFee({
          value: null,
          status: "error",
        })
      }
      return
    }

    return setFee({
      value: null,
      status: "set",
    })
  }

  initializeFee()

  return { ...fee, text: "" }
}

export default useFee
