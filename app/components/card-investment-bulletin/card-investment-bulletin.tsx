import React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  CardInvestmentBulletinKind,
  CardInvestmentBulletinState,
} from "@app/types/card-investment"

import { NotificationCardUI } from "../notifications/notification-card-ui"

type CardInvestmentBulletinProps = Pick<
  CardInvestmentBulletinState,
  "kind" | "progress"
> & {
  onDismiss: () => void
}

type BulletinContent = {
  title: string
  text: string
  action?: () => Promise<void>
  buttonLabel?: string
  dismissAction?: () => void
}

/**
 * The home card that walks a signed investor back to the payment, and welcomes them once
 * it is made. Each state reuses the flow's own step for what it asks: the shortfall
 * screen already decides between depositing and converting, and the transfer step
 * already bills the figure the agreement names, so the card opens those rather than
 * restating their decisions.
 */
export const CardInvestmentBulletin: React.FC<CardInvestmentBulletinProps> = ({
  kind,
  progress,
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const copy = LL.CardFlow.Onboarding.HomeBulletin
  const shortfallCopy = LL.CardFlow.Onboarding.InsufficientBalance

  /** Both shortfalls open the same step, which restates the figures and offers the
   *  matching remedy; the card only names which remedy that is. */
  const openShortfallStep = async () =>
    navigation.navigate("cardOnboardingInsufficientBalanceScreen", {
      selectedAmountUsd: progress.selectedAmountUsd,
    })

  /** Thunks, so only the card being shown resolves its copy. */
  const contentFor: Record<CardInvestmentBulletinKind, () => BulletinContent> = {
    [CardInvestmentBulletinKind.Insufficient]: () => ({
      title: copy.insufficient.title(),
      text: copy.insufficient.body(),
      action: openShortfallStep,
      buttonLabel: shortfallCopy.buttonText(),
    }),
    [CardInvestmentBulletinKind.SplitFunds]: () => ({
      title: shortfallCopy.splitFunds.title(),
      text: shortfallCopy.splitFunds.body(),
      action: openShortfallStep,
      buttonLabel: LL.common.convert(),
    }),
    [CardInvestmentBulletinKind.DepositPending]: () => ({
      title: copy.depositPending.title(),
      text: copy.depositPending.body(),
      action: async () => navigation.navigate("cardOnboardingDepositPendingScreen"),
    }),
    [CardInvestmentBulletinKind.Ready]: () => ({
      title: copy.ready.title(),
      text: copy.ready.body(),
      action: async () =>
        navigation.navigate("cardOnboardingTransferInvestScreen", {
          selectedAmountUsd: progress.selectedAmountUsd,
          settlementSats: progress.settlementSats,
        }),
      buttonLabel: LL.common.continue(),
    }),
    [CardInvestmentBulletinKind.Shareholder]: () => ({
      title: copy.shareholder.title(),
      text: copy.shareholder.body(),
      dismissAction: onDismiss,
    }),
  }

  return <NotificationCardUI {...contentFor[kind]()} />
}
