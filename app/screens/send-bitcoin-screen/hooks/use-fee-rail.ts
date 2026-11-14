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

export type FeeRail = {
  tiers: Record<FeeTierOption, FeeTierInfo>
  errorMessage: string | undefined
  /**
   * The address belongs to the sending wallet, so the payment can never go through and Next
   * stays off. Only the custodial backend tells this apart; the SDK has no such check.
   */
  isSelfPayment: boolean
  hasQuote: boolean
  isQuoting: boolean
  /** The SDK refused the amount as below the on-chain minimum: a refusal the sender fixes
   *  in place, so it buzzes like Low funds. */
  isAmountTooLow: boolean
}

export type SelfCustodialFeeRail = FeeRail & {
  /**
   * The only way this rail quotes: once, on Next, for the inputs on screen. Resolves to
   * the tiers, or null when it failed (the reason lands in errorMessage) or the inputs
   * moved on first.
   */
  quote: () => Promise<Record<FeeTierOption, FeeTierInfo> | null>
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
}: FeeRailParams): SelfCustodialFeeRail => {
  const { sdk } = useSelfCustodialWallet()
  const { LL } = useI18nContext()

  const settlementAmount = paymentDetail?.settlementAmount
  const amountSats =
    isActive && settlementAmount?.amount ? settlementAmount.amount : undefined
  const address = isActive ? paymentDetail?.destination : undefined

  const { tiers, error, hasQuote, isQuoting, quote } = useOnchainFeeTiers({
    sdk: sdk ?? null,
    address,
    amountSats,
    isFeeIncluded: Boolean(paymentDetail?.isFeeIncluded),
  })
  const errorMessage = error ? resolveSdkErrorMessage(error, LL) : undefined

  return {
    tiers,
    errorMessage,
    isSelfPayment: false,
    hasQuote,
    isQuoting,
    isAmountTooLow: error === FeeError.InvalidInput,
    quote,
  }
}

export const useCustodialFeeRail = ({
  paymentDetail,
  isActive,
}: FeeRailParams): FeeRail => {
  const { LL } = useI18nContext()

  const quotedAmount = paymentDetail?.destinationSpecifiedAmount
    ? paymentDetail.destinationSpecifiedAmount.amount
    : paymentDetail?.settlementAmount?.amount

  const { tiers, hasError, isSelfPayment, hasQuote, isQuoting } =
    useCustodialOnchainFeeTiers({
      walletId: isActive ? paymentDetail?.sendingWalletDescriptor.id : undefined,
      address: isActive ? paymentDetail?.destination : undefined,
      amount: isActive ? quotedAmount : undefined,
      /** Read from the payment detail so the tiers always quote the endpoint the send uses. */
      quote: isActive ? paymentDetail?.feeQuote : undefined,
    })

  /** The generic one is shared with the confirmation screen, so neither promises an
   *  impossible retry. */
  const feeErrorMessage = isSelfPayment
    ? LL.SendBitcoinScreen.onchainSelfPayment()
    : LL.common.feeError()

  return {
    tiers,
    errorMessage: hasError ? feeErrorMessage : undefined,
    isSelfPayment,
    hasQuote,
    isQuoting,
    isAmountTooLow: false,
  }
}
