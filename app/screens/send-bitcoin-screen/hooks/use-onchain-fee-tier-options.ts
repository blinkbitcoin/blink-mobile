import { useCallback, useState } from "react"

import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"
import { toWalletAmount } from "@app/types/amounts"

import { buildFeeTierOptions } from "../fee-tier-options"
import { type ParseDestinationResult } from "../payment-destination/index.types"
import { ConvertMoneyAmount, type PaymentDetail } from "../payment-details/index.types"

import { FeeTierOption, FeeUnit } from "./fee-tiers.types"
import {
  PAYOUT_SPEED_BY_FEE_TIER,
  useCustodialOnchainFeeTiers,
} from "./use-custodial-onchain-fee-tiers"
import {
  type SdkFeeError,
  SdkFeeError as FeeError,
  useOnchainFeeTiers,
} from "./use-onchain-fee-tiers"

type LL = ReturnType<typeof useI18nContext>["LL"]

/**
 * Read off the tier rather than guessed from the rail, so a cents fee can never be handed
 * to the sats formatter. A sat/vB rate only reaches the refund screen, which brings its own
 * formatter, but it is sats-denominated all the same.
 */
const CURRENCY_BY_FEE_UNIT: Record<FeeUnit, WalletCurrency> = {
  [FeeUnit.Sats]: WalletCurrency.Btc,
  [FeeUnit.Cents]: WalletCurrency.Usd,
  [FeeUnit.SatPerVbyte]: WalletCurrency.Btc,
}

const resolveFeeErrorMessage = (error: SdkFeeError, LL: LL): string => {
  if (error === FeeError.InsufficientFunds) {
    return LL.SendBitcoinScreen.sdkInsufficientFunds()
  }
  if (error === FeeError.InvalidInput) return LL.SendBitcoinScreen.sdkAmountTooLow()
  if (error === FeeError.NetworkError) return LL.SendBitcoinScreen.sdkNetworkError()

  return LL.SendBitcoinScreen.sdkGenericError()
}

type FeeTierOptionsParams = {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  isSelfCustodial: boolean
  paymentDestination: ParseDestinationResult | undefined
  convertMoneyAmount: ConvertMoneyAmount | undefined
}

export const useOnchainFeeTierOptions = ({
  paymentDetail,
  isSelfCustodial,
  paymentDestination,
  convertMoneyAmount,
}: FeeTierOptionsParams) => {
  const { sdk } = useSelfCustodialWallet()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { LL, locale } = useI18nContext()
  /**
   * Held as "nothing picked yet" rather than seeded with a default, because isSelfCustodial
   * reads false until the wallet finishes initializing. Deriving the fallback on each render
   * lets it follow the rail once that resolves, while an explicit choice still wins.
   */
  const [pickedFeeTier, setPickedFeeTier] = useState<FeeTierOption | null>(null)

  /**
   * Each rail falls back to the tier it would actually use if the user never opens the
   * selector: self-custodial sends default to Medium in the SDK wrapper, while custodial
   * payouts inherit the schema default of FAST.
   */
  const defaultFeeTier = isSelfCustodial ? FeeTierOption.Medium : FeeTierOption.Fast
  const feeTier = pickedFeeTier ?? defaultFeeTier

  const isOnchain = paymentDetail?.paymentType === PaymentType.Onchain
  const isSelfCustodialOnchain = isSelfCustodial && isOnchain
  const isCustodialOnchain = !isSelfCustodial && isOnchain

  const address = isOnchain ? paymentDetail?.destination : undefined
  const settlementAmount = paymentDetail?.settlementAmount

  const selfCustodialAmountSats =
    isSelfCustodialOnchain && settlementAmount?.amount
      ? settlementAmount.amount
      : undefined

  const selfCustodialAddress = isSelfCustodialOnchain ? address : undefined

  const {
    tiers: selfCustodialTiers,
    error: selfCustodialError,
    isQuoting: isQuotingSelfCustodialFees,
  } = useOnchainFeeTiers(sdk ?? null, selfCustodialAddress, selfCustodialAmountSats)

  /** Read from the payment detail so the tiers always quote the endpoint the send uses. */
  const custodialQuote = isCustodialOnchain ? paymentDetail?.feeQuote : undefined

  const quotedAmount = paymentDetail?.destinationSpecifiedAmount
    ? paymentDetail.destinationSpecifiedAmount.amount
    : settlementAmount?.amount

  /** All four gates move together: off the custodial on-chain rail nothing is quoted. */
  const custodialWalletId = isCustodialOnchain
    ? paymentDetail?.sendingWalletDescriptor.id
    : undefined
  const custodialAddress = isCustodialOnchain ? address : undefined
  const custodialAmount = isCustodialOnchain ? quotedAmount : undefined

  const {
    tiers: custodialTiers,
    hasError: hasCustodialError,
    isQuoting: isQuotingCustodialFees,
  } = useCustodialOnchainFeeTiers({
    walletId: custodialWalletId,
    address: custodialAddress,
    amount: custodialAmount,
    quote: custodialQuote,
  })

  const feeTiers = isSelfCustodial ? selfCustodialTiers : custodialTiers

  const selfCustodialErrorMessage = selfCustodialError
    ? resolveFeeErrorMessage(selfCustodialError, LL)
    : undefined
  const custodialErrorMessage = hasCustodialError
    ? LL.SendBitcoinScreen.feeEstimateError()
    : undefined
  const feeTierErrorMessage = isSelfCustodial
    ? selfCustodialErrorMessage
    : custodialErrorMessage

  /**
   * A self-custodial failure means the SDK could not build the transaction, so there is
   * nothing to continue to. A custodial quote is only an estimate: the confirmation screen
   * fetches its own and the mutation validates server-side, so a transient failure is worth
   * showing but must not strand the user on this screen with no way to retry.
   */
  const isFeeTierErrorBlocking = isSelfCustodial && Boolean(selfCustodialErrorMessage)

  /**
   * Label-level only: both rails hide the fee until it is quoted. The spinner stays
   * custodial-only, because the SDK answers fast enough that one would merely flicker.
   */
  const isQuotingFeeLabels = isSelfCustodial
    ? isQuotingSelfCustodialFees
    : isQuotingCustodialFees

  const feeTierOptions = buildFeeTierOptions({
    isQuoting: isQuotingFeeLabels,
    tiers: feeTiers,
    labels: {
      [FeeTierOption.Fast]: LL.SendBitcoinScreen.fast(),
      [FeeTierOption.Medium]: LL.SendBitcoinScreen.medium(),
      [FeeTierOption.Slow]: LL.SendBitcoinScreen.slow(),
    },
    formatFee: ({ feeAmount, feeUnit }) =>
      formatMoneyAmount({
        moneyAmount: toWalletAmount({
          amount: feeAmount,
          currency: CURRENCY_BY_FEE_UNIT[feeUnit],
        }),
      }),
    locale,
  })

  const rebuildForTier = useCallback(
    (
      tier: FeeTierOption,
      currentDetail: PaymentDetail<WalletCurrency>,
    ): PaymentDetail<WalletCurrency> | null => {
      if (currentDetail.paymentType !== PaymentType.Onchain) return null

      if (!isSelfCustodial) {
        if (!currentDetail.setPayoutSpeed) return null
        return currentDetail.setPayoutSpeed(PAYOUT_SPEED_BY_FEE_TIER[tier])
      }

      if (!sdk || !paymentDestination || !convertMoneyAmount) return null

      const wrapped = wrapDestination(paymentDestination, sdk, { feeTier: tier })
      if (!wrapped.valid || !("createPaymentDetail" in wrapped)) return null

      const rebuilt = wrapped.createPaymentDetail({
        convertMoneyAmount,
        sendingWalletDescriptor: currentDetail.sendingWalletDescriptor,
      })

      if (!currentDetail.unitOfAccountAmount.amount || !rebuilt.canSetAmount) {
        return rebuilt
      }
      return rebuilt.setAmount(currentDetail.unitOfAccountAmount)
    },
    [isSelfCustodial, sdk, paymentDestination, convertMoneyAmount],
  )

  const setFeeTier = useCallback(
    (
      tier: FeeTierOption,
      currentDetail: PaymentDetail<WalletCurrency> | null,
    ): PaymentDetail<WalletCurrency> | null => {
      /**
       * With nothing to rebuild yet only the selector moves; no payment carries the choice
       * until one is built, and the screen does not render the selector before then. Once a
       * payment does exist, a rebuild that fails leaves the old speed in place, so moving
       * the selector anyway would show a tier the payment never adopted.
       */
      if (!currentDetail || !isOnchain) {
        setPickedFeeTier(tier)
        return null
      }

      const rebuilt = rebuildForTier(tier, currentDetail)
      if (!rebuilt) return null

      setPickedFeeTier(tier)
      return rebuilt
    },
    [isOnchain, rebuildForTier],
  )

  return {
    feeTier,
    setFeeTier,
    feeTierOptions,
    isOnchain,
    feeTierErrorMessage,
    isFeeTierErrorBlocking,
    /** Only the custodial rail quotes over the network; the SDK answers near-instantly. */
    isQuotingFees: !isSelfCustodial && isQuotingCustodialFees,
  }
}
