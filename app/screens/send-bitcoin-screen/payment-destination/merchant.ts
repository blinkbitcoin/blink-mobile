import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType, type LnurlPaymentDestination } from "@blinkbitcoin/blink-client"

import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

import { resolveLnurlDestination } from "./lnurl"
import {
  type MerchantChoice,
  type ParseDestinationParams,
  type ParseDestinationResult,
} from "./index.types"

export const merchantChoiceToLnurlDestination = (
  merchant: MerchantChoice,
): LnurlPaymentDestination => ({
  paymentType: PaymentType.Lnurl,
  valid: true,
  lnurl: merchant.lnurl,
  isMerchant: true,
  merchant,
})

export const resolveMerchantChoiceDestination = async ({
  merchant,
  params,
  sdk,
}: {
  merchant: MerchantChoice
  params: ParseDestinationParams
  sdk: BreezSdkInterface | null
}): Promise<ParseDestinationResult> => {
  /** A self-custodial sender has no ledger to pay a till code over, connected sdk and all. */
  const intraledgerDomains = sdk ? [] : params.lnurlDomains

  const destination = await resolveLnurlDestination({
    parsedLnurlDestination: merchantChoiceToLnurlDestination(merchant),
    lnurlDomains: intraledgerDomains,
    accountDefaultWalletQuery: params.accountDefaultWalletQuery,
    myWalletIds: params.myWalletIds,
  })

  return sdk ? wrapDestination(destination, sdk) : destination
}
