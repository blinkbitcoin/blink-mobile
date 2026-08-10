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
import { useCustodialFeeRail, useSelfCustodialFeeRail } from "./use-fee-rail"
import { PAYOUT_SPEED_BY_FEE_TIER } from "./use-custodial-onchain-fee-tiers"

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

  const selfCustodialRail = useSelfCustodialFeeRail({
    paymentDetail,
    isActive: isSelfCustodial && isOnchain,
  })
  const custodialRail = useCustodialFeeRail({
    paymentDetail,
    isActive: !isSelfCustodial && isOnchain,
  })

  /** The one place the rail is chosen; everything below reads the winner plainly. */
  const feeRail = isSelfCustodial ? selfCustodialRail : custodialRail

  /**
   * The spinner stays custodial-only, because the SDK answers fast enough that one would
   * merely flicker. It is the single field the rails do not answer alike.
   */
  const isQuotingFees = !isSelfCustodial && custodialRail.isQuoting

  const feeTierOptions = buildFeeTierOptions({
    hasQuote: feeRail.hasQuote,
    tiers: feeRail.tiers,
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
    feeTierErrorMessage: feeRail.errorMessage,
    isFeeTierErrorBlocking: feeRail.isErrorBlocking,
    isQuotingFees,
  }
}
