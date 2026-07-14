import { useCallback, useEffect, useState } from "react"

/**
 * State mirror, not derived: closes on success immediately, before the balance
 * refetches to zero.
 */
export const useDollarBalanceForcedConversion = ({
  accountId,
  isRestricted,
  usdWalletBalance,
}: {
  accountId: string | undefined
  isRestricted: boolean
  usdWalletBalance: number
}): { isConvertModalVisible: boolean; closeConvertModal: () => void } => {
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false)
  const hasConvertibleBalance = isRestricted && usdWalletBalance > 0

  /** The home screen survives account switches, so a latch set by one account
   *  must not leak the modal into the next one. */
  useEffect(() => {
    setIsConvertModalVisible(false)
  }, [accountId])

  /** `accountId` re-arms the trigger after the reset above, so an account that
   *  is itself restricted with a positive balance still opens its own modal. */
  useEffect(() => {
    if (hasConvertibleBalance) setIsConvertModalVisible(true)
  }, [accountId, hasConvertibleBalance])

  const closeConvertModal = useCallback(() => setIsConvertModalVisible(false), [])

  return { isConvertModalVisible, closeConvertModal }
}
