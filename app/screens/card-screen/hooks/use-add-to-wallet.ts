import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import {
  addCardToWallet,
  canAddCardToWallet,
  WalletAddResult,
  WalletCard,
} from "../utils/wallet-provisioning"

export const useAddToWallet = (
  cardId: string | undefined,
  lastFour: string | undefined,
) => {
  const { LL } = useI18nContext()
  const [canAddToWallet, setCanAddToWallet] = useState(false)
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
    setCanAddToWallet(false)
    if (!walletCard) return

    let isCurrent = true
    /** The button only shows once the wallet confirms it can take the card, so a
     *  failed check keeps it hidden. */
    const checkWallet = async () => {
      const canAdd = await canAddCardToWallet(walletCard).catch(() => false)
      if (isCurrent) setCanAddToWallet(canAdd)
    }
    checkWallet()

    return () => {
      isCurrent = false
    }
  }, [walletCard])

  const addToWallet = useCallback(async () => {
    if (!walletCard) return

    /** One wallet sheet at a time, and an answer only lands on the screen and the card
     *  that asked for it: a card switched or a screen left mid-add drops the late result. */
    await run(async () => {
      const isStillShown = () => isMounted() && shownCardRef.current === walletCard
      setIsAdding(true)
      try {
        const result = await addCardToWallet(walletCard)
        const shouldStopOffering = result === WalletAddResult.Added && isStillShown()
        if (shouldStopOffering) setCanAddToWallet(false)
      } catch {
        if (isStillShown()) toastShow({ message: LL.errors.unexpectedError(), LL })
      } finally {
        if (isMounted()) setIsAdding(false)
      }
    })
  }, [walletCard, run, isMounted, LL])

  return { canAddToWallet, isAdding, addToWallet }
}
