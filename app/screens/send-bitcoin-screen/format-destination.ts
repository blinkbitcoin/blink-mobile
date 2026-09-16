import { WalletCurrency } from "@app/graphql/generated"
import { ellipsizeMiddle } from "@app/utils/helper"

import { PaymentDetail } from "./payment-details/index.types"

/** Raw addresses and invoices keep their first 10 and last 8 characters
 *  ("bc1q6pwejx...mg9fq4aw"); readable handles stay whole. */
const RAW_DESTINATION_START = 10
const RAW_DESTINATION_END = 8

/**
 * How a destination reads on amount entry and the completed screen, which shorten it the
 * same way. Review's destination field fills its width instead and only borrows the
 * username host from here.
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
