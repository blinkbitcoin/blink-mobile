import React, { useMemo } from "react"

import { useTheme } from "@rn-vui/themed"

import { InfoCard, InfoSection } from "@app/components/card-screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Delivery, DeliveryType } from "@app/screens/card-screen/types"

import { Issue, IssueType } from "./types"

type ConfirmStepProps = {
  issueType: IssueType
  deliveryType: DeliveryType
  isVirtualCard: boolean
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({
  issueType,
  deliveryType,
  isVirtualCard,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

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

  const summaryItems = useMemo(() => {
    const items: { label: string; value: string; valueColor?: string }[] = [
      {
        label: confirmLL.issueType(),
        value: issueTypeLabels[issueType],
      },
    ]

    if (!isVirtualCard) {
      const deliveryConfig = replaceCardDeliveryConfig[deliveryType]
      const deliveryLabels: Record<DeliveryType, string> = {
        [Delivery.Standard]: deliveryLL.standardDelivery(),
        [Delivery.Express]: deliveryLL.expressDelivery(),
      }
      const deliveryPrice =
        deliveryConfig.priceUsd === 0
          ? deliveryLL.free()
          : formatCurrency({
              amountInMajorUnits: deliveryConfig.priceUsd,
              currency: WalletCurrency.Usd,
            })

      items.push(
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
      )
    }

    return items
  }, [
    confirmLL,
    issueTypeLabels,
    issueType,
    isVirtualCard,
    replaceCardDeliveryConfig,
    deliveryType,
    deliveryLL,
    formatCurrency,
    colors._green,
  ])

  return (
    <>
      <InfoSection title={confirmLL.requestSummary()} items={summaryItems} />

      <InfoCard
        title={confirmLL.importantInformation()}
        bulletItems={(() => {
          const info =
            issueType === Issue.Damaged ? confirmLL.DamagedInfo : confirmLL.LostStolenInfo
          return [info.bullet1(), info.bullet2(), info.bullet3()]
        })()}
        showIcon={false}
        size="lg"
      />
    </>
  )
}
