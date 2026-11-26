import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction"
import { ellipsizeMiddle } from "@app/utils/helper"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { PaymentDetailType } from "./payment-details/index.types"

/** How the receipt prints a recipient. Addresses and handles wrap in full; an
 *  invoice or a bech32 LNURL can't be read by eye, so one over 50 characters is
 *  shortened in the middle. A Lightning address is under the limit and stays whole. */
export const receiptDestination = (
  paymentType: PaymentDetailType,
  destination: string,
): string => {
  switch (paymentType) {
    case PaymentType.Lightning:
    case PaymentType.Lnurl:
      return ellipsizeMiddle(destination)
    case PaymentType.Intraledger:
    case PaymentType.Onchain:
    case SelfCustodialPaymentType.Spark:
      return destination
    default: {
      const unhandled: never = paymentType
      return unhandled
    }
  }
}
