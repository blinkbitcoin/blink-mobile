import { useCallback, useState } from "react"

import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { wrapDestinationForSC } from "@app/self-custodial/payment-details/wrap-destination"
import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  ConvertMoneyAmount,
  type PaymentDetail,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { type ParseDestinationResult } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"

import { formatFeeTierOptions } from "./format-fee-tier-options"
import {
  FeeTierOption,
  type SdkFeeError,
  SdkFeeError as FeeError,
  useOnchainFeeTiers,
} from "./use-onchain-fee-tiers"

type LL = ReturnType<typeof useI18nContext>["LL"]

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
  const [feeTier, setFeeTierState] = useState<FeeTierOption>(FeeTierOption.Medium)

  const isOnchain = isSelfCustodial && paymentDetail?.paymentType === PaymentType.Onchain

  const onchainAddress = isOnchain ? paymentDetail?.destination : undefined
  const onchainAmountSats =
    isOnchain && paymentDetail?.settlementAmount?.amount
      ? paymentDetail.settlementAmount.amount
      : undefined

  const { tiers: feeTiers, error: feeError } = useOnchainFeeTiers(
    sdk ?? null,
    onchainAddress,
    onchainAmountSats,
  )

  const feeTierErrorMessage = feeError ? resolveFeeErrorMessage(feeError, LL) : undefined

  const feeTierOptions = formatFeeTierOptions({
    tiers: feeTiers,
    labels: {
      [FeeTierOption.Fast]: LL.SendBitcoinScreen.fast(),
      [FeeTierOption.Medium]: LL.SendBitcoinScreen.medium(),
      [FeeTierOption.Slow]: LL.SendBitcoinScreen.slow(),
    },
    formatSats: (sats) => formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(sats) }),
    locale,
  })

  const rebuildForTier = useCallback(
    (
      tier: FeeTierOption,
      currentDetail: PaymentDetail<WalletCurrency>,
    ): PaymentDetail<WalletCurrency> | null => {
      if (!sdk || !paymentDestination || !convertMoneyAmount) return null
      if (currentDetail.paymentType !== PaymentType.Onchain) return null

      const wrapped = wrapDestinationForSC(paymentDestination, sdk, { feeTier: tier })
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
    [sdk, paymentDestination, convertMoneyAmount],
  )

  const setFeeTier = useCallback(
    (
      tier: FeeTierOption,
      currentDetail: PaymentDetail<WalletCurrency> | null,
    ): PaymentDetail<WalletCurrency> | null => {
      setFeeTierState(tier)
      if (!currentDetail || !isOnchain) return null
      return rebuildForTier(tier, currentDetail)
    },
    [isOnchain, rebuildForTier],
  )

  return { feeTier, setFeeTier, feeTierOptions, isOnchain, feeTierErrorMessage }
}
