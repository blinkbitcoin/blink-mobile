import { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import {
  CardStatus,
  useCardBalanceQuery,
  useCardUpdateMutation,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getErrorMessages } from "@app/graphql/utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../../hooks/use-card-data"

export const useCloseCardAccount = () => {
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { moneyAmountToDisplayCurrencyString } = useDisplayCurrency()

  const { card } = useCardData()
  const cardId = card?.id

  const [cardUpdateMutation, { loading }] = useCardUpdateMutation()

  const { data: balanceData } = useCardBalanceQuery({
    variables: { cardId: cardId! },
    skip: !isAuthed || !cardId,
    fetchPolicy: "cache-first",
  })

  const pendingSats = balanceData?.cardBalance?.pending ?? 0
  const availableSats = balanceData?.cardBalance?.available ?? 0

  const hasPendingTransactions = pendingSats > 0
  const hasPositiveBalance = availableSats > 0

  const btcAmount = toBtcMoneyAmount(availableSats)
  const balanceDisplay =
    moneyAmountToDisplayCurrencyString({ moneyAmount: btcAmount, isApproximate: true }) ??
    ""

  const closeCard = useCallback(async () => {
    if (!cardId) {
      toastShow({
        message: LL.CardFlow.CardSettings.closeCardError(),
        type: "warning",
        LL,
      })
      return
    }

    try {
      const { data, errors } = await cardUpdateMutation({
        variables: { input: { cardId, status: CardStatus.Canceled } },
      })

      if (errors) {
        toastShow({ message: getErrorMessages(errors), LL })
        return
      }

      if (!data?.cardUpdate) {
        toastShow({
          message: LL.CardFlow.CardSettings.closeCardError(),
          type: "warning",
          LL,
        })
        return
      }

      navigation.replace("cardStatusScreen", {
        title: LL.CardFlow.CardSettings.closeCardSuccessTitle(),
        subtitle: LL.CardFlow.CardSettings.closeCardSuccessSubtitle(),
        buttonLabel: LL.CardFlow.CardSettings.closeCardSuccessButton(),
        navigateTo: "Primary",
        iconName: "info",
        iconColor: undefined,
      })
    } catch (err) {
      if (err instanceof Error) {
        toastShow({ message: err.message, LL })
      }
    }
  }, [cardId, cardUpdateMutation, LL, navigation])

  return {
    closeCard,
    loading,
    hasPendingTransactions,
    hasPositiveBalance,
    balanceDisplay,
  }
}
