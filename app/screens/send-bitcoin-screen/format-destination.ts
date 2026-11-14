import { WalletCurrency } from "@app/graphql/generated"
import { ellipsizeMiddle } from "@app/utils/helper"

import { PaymentDetail } from "./payment-details/index.types"

/** Raw addresses and invoices keep their first 10 and last 8 characters
 *  ("bc1q6pwejx...mg9fq4aw"); readable handles stay whole. */
const RAW_DESTINATION_START = 10
const RAW_DESTINATION_END = 8

/**
 * How a destination reads across the whole send flow — amount entry, review and the
 * completed screen all shorten it the same way, so the string never changes shape between
 * the screen the sender confirms and the one they end on.
 */
export const formatDestination = ({
  destination,
  paymentType,
  lnAddressHostname,
}: {
  destination: string
  paymentType: PaymentDetail<WalletCurrency>["paymentType"]
  lnAddressHostname: string
}) => {
  if (paymentType === "intraledger") return `${destination}@${lnAddressHostname}`
  if (paymentType === "lnurl") return destination
  return ellipsizeMiddle(destination, {
    maxLength: RAW_DESTINATION_START + RAW_DESTINATION_END + 3,
    maxResultLeft: RAW_DESTINATION_START,
    maxResultRight: RAW_DESTINATION_END,
  })
}
