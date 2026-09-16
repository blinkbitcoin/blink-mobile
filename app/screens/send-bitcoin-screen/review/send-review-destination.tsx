import React from "react"

import { ActionField } from "@app/components/action-field"
import { WalletCurrency } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"

import { formatDestination } from "../format-destination"
import { PaymentDetail } from "../payment-details/index.types"

export const SEND_REVIEW_DESTINATION_TEST_ID = "send-review-destination"
export const SEND_REVIEW_COPY_TEST_ID = "send-review-copy-destination"

type SendReviewDestinationProps = {
  destination: string
  paymentType: PaymentDetail<WalletCurrency>["paymentType"]
  onCopy: () => void
}

/** The destination, as the card flow's `ActionField`: a labelled value with one action.
 *  The action is copy, and the whole field is the button, not just the icon.
 *  A raw address or invoice goes in whole and shortens in the middle at whatever width the
 *  field has, as the old confirmation screen did, rather than at a fixed character count. */
export const SendReviewDestination: React.FC<SendReviewDestinationProps> = ({
  destination,
  paymentType,
  onCopy,
}) => {
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const typeLabel = {
    intraledger: LL.common.intraledger(),
    onchain: LL.common.onchain(),
    lightning: LL.common.lightning(),
    lnurl: LL.common.lightning(),
    spark: LL.common.spark(),
  }[paymentType]

  return (
    <ActionField
      label={`${LL.SendBitcoinScreen.destination()} - ${typeLabel}`}
      value={
        paymentType === "intraledger"
          ? formatDestination({ destination, paymentType, lnAddressHostname })
          : destination
      }
      icon="copy-paste"
      iconSize={16}
      numberOfLines={1}
      onAction={onCopy}
      testID={SEND_REVIEW_COPY_TEST_ID}
      valueTestID={SEND_REVIEW_DESTINATION_TEST_ID}
    />
  )
}
