import React, { useMemo } from "react"

import { useTheme } from "@rn-vui/themed"

import { InfoCard, InfoSection } from "@app/components/card-screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"

import { Delivery, DeliveryType, Issue, IssueType } from "./types"

type ConfirmStepProps = {
  issueType: IssueType
  deliveryType: DeliveryType
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({ issueType, deliveryType }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const deliveryConfig = replaceCardDeliveryConfig[deliveryType]
  const {
    ReportIssue: reportIssueLL,
    Delivery: deliveryLL,
    Confirm: confirmLL,
  } = LL.CardFlow.ReplaceCard

  const issueTypeLabels = useMemo<Record<IssueType, string>>(
    () => ({
      [Issue.Lost]: reportIssueLL.lostCard(),
      [Issue.Stolen]: reportIssueLL.stolenCard(),
      [Issue.Damaged]: reportIssueLL.damagedCard(),
    }),
    [reportIssueLL],
  )

  const deliveryLabels = useMemo<Record<DeliveryType, string>>(
    () => ({
      [Delivery.Standard]: deliveryLL.standardDelivery(),
      [Delivery.Express]: deliveryLL.expressDelivery(),
    }),
    [deliveryLL],
  )

  const deliveryPrice =
    deliveryConfig.priceUsd === 0
      ? deliveryLL.free()
      : formatCurrency({
          amountInMajorUnits: deliveryConfig.priceUsd,
          currency: WalletCurrency.Usd,
        })

  return (
    <>
      <InfoSection
        title={confirmLL.requestSummary()}
        items={[
          {
            label: confirmLL.issueType(),
            value: issueTypeLabels[issueType],
          },
          {
            label: confirmLL.delivery(),
            value: deliveryLabels[deliveryType],
          },
          {
            label: confirmLL.deliveryTime(),
            value: deliveryLL.businessDays({
              day1: deliveryConfig.minDays.toString(),
              day2: deliveryConfig.maxDays.toString(),
            }),
          },
          {
            label: confirmLL.shippingCost(),
            value: deliveryPrice,
            valueColor: deliveryType === Delivery.Standard ? colors._green : undefined,
          },
        ]}
      />

      <InfoCard
        title={confirmLL.importantInformation()}
        bulletItems={[confirmLL.bullet1(), confirmLL.bullet2(), confirmLL.bullet3()]}
        showIcon={false}
        size="lg"
      />
    </>
  )
}
