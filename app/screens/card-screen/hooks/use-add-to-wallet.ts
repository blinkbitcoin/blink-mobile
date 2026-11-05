import { useCallback, useEffect, useMemo, useState } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
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

  const walletCard = useMemo<WalletCard | undefined>(
    () => (cardId && lastFour ? { cardId, lastFour } : undefined),
    [cardId, lastFour],
  )

  useEffect(() => {
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

    /** One wallet sheet at a time: a second tap before the first answer must not open
     *  another one. */
    await run(async () => {
      setIsAdding(true)
      try {
        const result = await addCardToWallet(walletCard)
        if (result === WalletAddResult.Added) setCanAddToWallet(false)
      } catch {
        toastShow({ message: LL.errors.unexpectedError(), LL })
      } finally {
        setIsAdding(false)
      }
    })
  }, [walletCard, run, LL])

  return { canAddToWallet, isAdding, addToWallet }
}
