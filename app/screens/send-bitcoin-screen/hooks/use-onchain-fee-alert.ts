import { useEffect, useState } from "react"

import { Network, useOnChainTxFeeLazyQuery, WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount } from "@app/types/amounts"

import type { PaymentDetail } from "../payment-details/index.types"

type UseOnchainFeeAlertParams = {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  walletId: string
  network: Network | undefined
  isSelfCustodial: boolean
}

export const useOnchainFeeAlert = ({
  paymentDetail,
  walletId,
  network,
  isSelfCustodial,
}: UseOnchainFeeAlertParams) => {
  const dummyAddress =
    network === "mainnet"
      ? "bc1qk2cpytjea36ry6vga8wwr7297sl3tdkzwzy2cw"
      : "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"

  const isOnchainPayment =
    !isSelfCustodial &&
    walletId &&
    paymentDetail &&
    paymentDetail.paymentType === "onchain"

  const [getOnChainTxFee] = useOnChainTxFeeLazyQuery({
    fetchPolicy: "cache-and-network",
    variables: {
      walletId,
      amount: 1000,
      address: dummyAddress,
    },
  })

  const [onChainTxFee, setOnChainTxFee] = useState(0)

  useEffect(() => {
    if (isOnchainPayment) {
      ;(async () => {
        const result = await getOnChainTxFee()
        const fees = result.data?.onChainTxFee.amount

        if (fees) {
          setOnChainTxFee(fees)
        } else {
          console.error("failed to get onchain fees")
        }
      })()
    }
  }, [getOnChainTxFee, isOnchainPayment])

  if (!isOnchainPayment) return false

  const { convertMoneyAmount } = paymentDetail

  const ratioFeesToAmount = 2
  const ratioedFees = toBtcMoneyAmount(onChainTxFee * ratioFeesToAmount)

  return (
    paymentDetail.paymentType === "onchain" &&
    convertMoneyAmount(paymentDetail.settlementAmount, WalletCurrency.Btc).amount <
      ratioedFees.amount
  )
}
