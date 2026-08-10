import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

import { type PaymentDetail } from "../payment-details/index.types"

import { type FeeTierInfo, type FeeTierOption } from "./fee-tiers.types"
import { useCustodialOnchainFeeTiers } from "./use-custodial-onchain-fee-tiers"
import {
  type SdkFeeError,
  SdkFeeError as FeeError,
  useOnchainFeeTiers,
} from "./use-onchain-fee-tiers"

type LL = ReturnType<typeof useI18nContext>["LL"]

/**
 * What every rail owes the selector, so the caller picks one rail and reads it plainly
 * instead of pairing each field with a fresh isSelfCustodial ternary.
 */
export type FeeRail = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  errorMessage: string | undefined
  hasQuote: boolean
  /**
   * Whether a failure here should stop the send. A self-custodial failure means the SDK
   * could not build the transaction, so there is nothing to continue to. A custodial quote
   * is only an estimate: the confirmation screen fetches its own and the mutation validates
   * server-side, so a transient failure is worth showing but must not strand the user.
   */
  isErrorBlocking: boolean
}

type FeeRailParams = {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  isActive: boolean
}

const resolveSdkErrorMessage = (error: SdkFeeError, LL: LL): string => {
  if (error === FeeError.InsufficientFunds) {
    return LL.SendBitcoinScreen.sdkInsufficientFunds()
  }
  if (error === FeeError.InvalidInput) return LL.SendBitcoinScreen.sdkAmountTooLow()
  if (error === FeeError.NetworkError) return LL.SendBitcoinScreen.sdkNetworkError()

  return LL.SendBitcoinScreen.sdkGenericError()
}

export const useSelfCustodialFeeRail = ({
  paymentDetail,
  isActive,
}: FeeRailParams): FeeRail => {
  const { sdk } = useSelfCustodialWallet()
  const { LL } = useI18nContext()

  const settlementAmount = paymentDetail?.settlementAmount
  const amountSats =
    isActive && settlementAmount?.amount ? settlementAmount.amount : undefined
  const address = isActive ? paymentDetail?.destination : undefined

  const { tiers, error, hasQuote } = useOnchainFeeTiers(sdk ?? null, address, amountSats)
  const errorMessage = error ? resolveSdkErrorMessage(error, LL) : undefined

  return { tiers, errorMessage, hasQuote, isErrorBlocking: Boolean(errorMessage) }
}

export const useCustodialFeeRail = ({
  paymentDetail,
  isActive,
}: FeeRailParams): FeeRail & { isQuoting: boolean } => {
  const { LL } = useI18nContext()

  /** The destination's own amount wins, because that is what the send will settle. */
  const quotedAmount = paymentDetail?.destinationSpecifiedAmount
    ? paymentDetail.destinationSpecifiedAmount.amount
    : paymentDetail?.settlementAmount?.amount

  const { tiers, hasError, hasQuote, isQuoting } = useCustodialOnchainFeeTiers({
    walletId: isActive ? paymentDetail?.sendingWalletDescriptor.id : undefined,
    address: isActive ? paymentDetail?.destination : undefined,
    amount: isActive ? quotedAmount : undefined,
    /** Read from the payment detail so the tiers always quote the endpoint the send uses. */
    quote: isActive ? paymentDetail?.feeQuote : undefined,
  })

  return {
    tiers,
    errorMessage: hasError ? LL.SendBitcoinScreen.feeEstimateError() : undefined,
    hasQuote,
    isErrorBlocking: false,
    isQuoting,
  }
}
