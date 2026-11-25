import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { gql, useApolloClient } from "@apollo/client"
import { useNavigation } from "@react-navigation/native"

import { useCardWalletAddConfirmMutation } from "@app/graphql/generated"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { toastShow } from "@app/utils/toast"

import { WalletAddResult, type WalletCard } from "../types"
import { fetchCardProvisioningData } from "../utils/card-provisioning-data"
import { addCardToWallet, canAddCardToWallet } from "../utils/wallet-provisioning"

gql`
  mutation cardWalletAddConfirm($input: CardWalletAddConfirmInput!) {
    cardWalletAddConfirm(input: $input) {
      id
      walletAddedAt
    }
  }
`

export const useAddToWallet = (
  cardId: string | undefined,
  lastFour: string | undefined,
) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation()
  const client = useApolloClient()
  const [confirmWalletAdd] = useCardWalletAddConfirmMutation()
  /** Unknown until the wallet on this device answers whether it can take the card. */
  const [canWalletTakeCard, setCanWalletTakeCard] = useState<boolean | undefined>()
  const [isAdded, setIsAdded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const { run } = useInFlightGuard()
  const isMounted = useIsMounted()

  const walletCard = useMemo<WalletCard | undefined>(() => {
    if (!cardId) return undefined
    if (!lastFour) return undefined
    return { cardId, lastFour }
  }, [cardId, lastFour])
  const shownCardRef = useRef(walletCard)

  useEffect(() => {
    shownCardRef.current = walletCard
    setCanWalletTakeCard(undefined)
    setIsAdded(false)
    if (!walletCard) return

    let isCurrent = true
    /** The button only shows once the wallet confirms it can take the card, so a
     *  failed check keeps it hidden. */
    const checkWallet = async () => {
      const canAdd = await canAddCardToWallet(walletCard).catch(() => false)
      if (isCurrent) setCanWalletTakeCard(canAdd)
    }
    checkWallet()

    return () => {
      isCurrent = false
    }
  }, [walletCard])

  const fetchProvisioningData = useCallback(
    (id: string) => fetchCardProvisioningData(client, id),
    [client],
  )

  /** The wallet holds the card whatever blink-card answers, so a failed report is only
   *  recorded, and the activation may offer the wallet once more. */
  const reportWalletAdd = useCallback(
    async (id: string) => {
      try {
        await confirmWalletAdd({ variables: { input: { cardId: id } } })
      } catch (err) {
        recordAppError(toError(err))
      }
    },
    [confirmWalletAdd],
  )

  const addToWallet = useCallback(async (): Promise<WalletAddResult | undefined> => {
    if (!walletCard) return undefined

    /** One wallet sheet at a time, and an answer only lands on the screen and the card
     *  that asked for it: a card switched or a screen left mid-add drops the late result. */
    return run(async () => {
      const isStillShown = () => isMounted() && shownCardRef.current === walletCard
      setIsAdding(true)
      try {
        const result = await addCardToWallet(walletCard, fetchProvisioningData)
        const isCardAdded = result === WalletAddResult.Added
        if (isCardAdded) await reportWalletAdd(walletCard.cardId)
        const shouldStopOffering = isCardAdded && isStillShown()
        if (shouldStopOffering) setIsAdded(true)
        return result
      } catch {
        /** A screen left mounted under the one the user moved on to keeps its state, but
         *  does not raise its toast over that screen. */
        const shouldShowError = isStillShown() && navigation.isFocused()
        if (shouldShowError) toastShow({ message: LL.errors.unexpectedError(), LL })
        return undefined
      } finally {
        if (isMounted()) setIsAdding(false)
      }
    })
  }, [walletCard, run, isMounted, fetchProvisioningData, reportWalletAdd, navigation, LL])

  const canAddToWallet = canWalletTakeCard === true && !isAdded
  /** The wallet answered that it cannot take this card, as on a phone without one. */
  const isWalletUnavailable = canWalletTakeCard === false

  return { canAddToWallet, isWalletUnavailable, isAdding, addToWallet }
}
