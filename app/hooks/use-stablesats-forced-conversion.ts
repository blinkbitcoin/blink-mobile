import { useCallback, useEffect, useState } from "react"

/**
 * State mirror, not derived: closes on success immediately, before the balance
 * refetches to zero.
 */
export const useStablesatsForcedConversion = ({
  isRestricted,
  usdWalletBalance,
}: {
  isRestricted: boolean
  usdWalletBalance: number
}): { isConvertModalVisible: boolean; closeConvertModal: () => void } => {
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false)
  const hasConvertibleBalance = isRestricted && usdWalletBalance > 0

  useEffect(() => {
    if (hasConvertibleBalance) setIsConvertModalVisible(true)
  }, [hasConvertibleBalance])

  const closeConvertModal = useCallback(() => setIsConvertModalVisible(false), [])

  return { isConvertModalVisible, closeConvertModal }
}
