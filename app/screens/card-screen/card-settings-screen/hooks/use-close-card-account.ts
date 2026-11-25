import { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CardStatus, useCardUpdateMutation } from "@app/graphql/generated"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { useCardBalance, useCardData } from "@app/hooks"

export const useCloseCardAccount = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { card } = useCardData()
  const cardId = card?.id

  const [cardUpdateMutation, { loading }] = useCardUpdateMutation()

  /** The member's Card Balance: what is still available, and what unsettled payments hold. */
  const {
    availableSats = 0,
    pendingSats = 0,
    balanceSecondary: balanceDisplay,
  } = useCardBalance({ skip: !cardId })

  const hasPendingTransactions = pendingSats > 0
  const hasPositiveBalance = availableSats > 0

  const closeCard = useCallback(async () => {
    if (!cardId || loading) {
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
        iconColor: "red",
        showCard: false,
        showAddToWallet: false,
      })
    } catch (err) {
      if (err instanceof Error) {
        toastShow({ message: err.message, LL })
      }
    }
  }, [cardId, loading, cardUpdateMutation, LL, navigation])

  return {
    closeCard,
    loading,
    hasPendingTransactions,
    hasPositiveBalance,
    balanceDisplay,
  }
}
