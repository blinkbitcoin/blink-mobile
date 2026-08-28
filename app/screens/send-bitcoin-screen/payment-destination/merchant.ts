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
  const destination = await resolveLnurlDestination({
    parsedLnurlDestination: merchantChoiceToLnurlDestination(merchant),
    lnurlDomains: params.lnurlDomains,
    accountDefaultWalletQuery: params.accountDefaultWalletQuery,
    myWalletIds: params.myWalletIds,
    lnAddressHostname: params.lnAddressHostname,
  })

  return sdk ? wrapDestination(destination, sdk) : destination
}
