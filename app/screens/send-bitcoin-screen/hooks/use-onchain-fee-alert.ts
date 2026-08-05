import { useEffect, useState } from "react"

import {
  Network,
  PayoutSpeed,
  useOnChainTxFeeLazyQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"

import type { PaymentDetail } from "../payment-details/index.types"

/** Probe size used to read the going rate, not the amount the user is sending. */
const PROBE_AMOUNT_SATS = 1000

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

  /**
   * The warning compares the payment against the going rate for the speed the user picked,
   * so it must follow the selector: probing the Fast queue while the payment is queued as
   * Flexible warns about a fee the sender is not paying.
   */
  const payoutSpeed = paymentDetail?.payoutSpeed ?? PayoutSpeed.Fast

  const [getOnChainTxFee] = useOnChainTxFeeLazyQuery({
    fetchPolicy: "cache-and-network",
  })

  const [onChainTxFee, setOnChainTxFee] = useState(0)

  useEffect(() => {
    if (!isOnchainPayment) return undefined

    /**
     * Switching tiers re-probes, so several requests can be in flight at once. Without this
     * the slowest response would win and the warning would be measured against a rate the
     * sender is not paying; it also stops a late response writing state after unmount.
     */
    let isStale = false

    ;(async () => {
      const result = await getOnChainTxFee({
        variables: {
          walletId,
          amount: PROBE_AMOUNT_SATS,
          address: dummyAddress,
          speed: payoutSpeed,
        },
      })
      if (isStale) return

      const fees = result.data?.onChainTxFee.amount

      if (fees) {
        setOnChainTxFee(fees)
      } else {
        reportError("use-onchain-fee-alert", new Error("Missing on-chain fee probe data"))
      }
    })()

    return () => {
      isStale = true
    }
  }, [getOnChainTxFee, isOnchainPayment, walletId, dummyAddress, payoutSpeed])

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
