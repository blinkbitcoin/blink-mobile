import React, { useMemo } from "react"

import { useTheme } from "@rn-vui/themed"

import { InfoCard, InfoSection } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCourierDelivery } from "@app/screens/card-screen/hooks"

import { Issue, IssueType } from "./types"

type ConfirmStepProps = {
  issueType: IssueType
  isVirtualCard: boolean
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({ issueType, isVirtualCard }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const courier = useCourierDelivery()

  const { ReportIssue: reportIssueLL, Confirm: confirmLL } = LL.CardFlow.ReplaceCard

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

    /** The cost row is labelled with the courier itself, as the PRD asks (D126). */
    if (!isVirtualCard) {
      items.push(
        {
          label: confirmLL.delivery(),
          value: courier.title,
        },
        {
          label: confirmLL.deliveryTime(),
          value: courier.businessDays,
        },
        {
          label: courier.title,
          value: courier.replacementPrice,
          valueColor: courier.isReplacementFree ? colors.success : undefined,
        },
      )
    }

    return items
  }, [confirmLL, issueTypeLabels, issueType, isVirtualCard, courier, colors.success])

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
