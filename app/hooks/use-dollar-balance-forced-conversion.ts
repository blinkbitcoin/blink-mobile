import { useCallback, useEffect, useState } from "react"

/**
 * State mirror, not derived: closes on success immediately, before the balance
 * refetches to zero. The latch still drops once the balance stops being
 * convertible, so a stale re-open cannot outlive the refetch.
 */
export const useDollarBalanceForcedConversion = ({
  accountId,
  isRestricted,
  usdWalletBalance,
  minimumBalance,
  isFocused,
}: {
  accountId: string | undefined
  isRestricted: boolean
  usdWalletBalance: number
  /** null while unknown: a quote cannot succeed before the conversion minimum
   *  resolves, so the trigger stays closed instead of opening a doomed modal. */
  minimumBalance: number | null
  isFocused: boolean
}): { isConvertModalVisible: boolean; closeConvertModal: () => void } => {
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false)
  const hasConvertibleBalance =
    isRestricted && minimumBalance !== null && usdWalletBalance >= minimumBalance

  /** The home screen survives account switches, so a latch set by one account
   *  must not leak the modal into the next one. */
  useEffect(() => {
    setIsConvertModalVisible(false)
  }, [accountId])

  /** `accountId` re-arms the trigger after the reset above; `isFocused` re-arms
   *  it after a manual close (possible only on a failed quote), so closing is
   *  never final: the next visit to the home screen retries. Losing the
   *  convertible balance closes the latch, because a focus re-open can race the
   *  post-conversion refetch and resurrect the modal on a stale balance; without
   *  the close it would stay locked on funds that no longer exist. */
  useEffect(() => {
    if (!hasConvertibleBalance) {
      setIsConvertModalVisible(false)
      return
    }
    if (isFocused) setIsConvertModalVisible(true)
  }, [accountId, hasConvertibleBalance, isFocused])

  const closeConvertModal = useCallback(() => setIsConvertModalVisible(false), [])

  return { isConvertModalVisible, closeConvertModal }
}
