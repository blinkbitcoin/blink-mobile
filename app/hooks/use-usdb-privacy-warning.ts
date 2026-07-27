import { useCallback } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getUsdbPrivacyWarningAcknowledged,
  withUsdbPrivacyWarningAcknowledged,
} from "@app/store/persistent-state/usdb-privacy-warning-acknowledged"

type UsdbPrivacyWarningProps = {
  /** Whether the caller is in a context that exposes the user to public USDB activity.
   *  Callers own that judgement; the hook only decides whether it has been acknowledged. */
  enabled: boolean
}

type UsdbPrivacyWarningReturn = {
  isVisible: boolean
  acknowledge: () => void
}

/** Spark keeps bitcoin balances and transactions private, but the USDB token backing the
 *  non-custodial dollar balance is publicly readable. Warn once per account before the
 *  user holds value in dollars. */
export const useUsdbPrivacyWarning = ({
  enabled,
}: UsdbPrivacyWarningProps): UsdbPrivacyWarningReturn => {
  const { persistentState, updateState } = usePersistentStateContext()

  const acknowledge = useCallback(() => {
    updateState((prev) => prev && withUsdbPrivacyWarningAcknowledged(prev))
  }, [updateState])

  return {
    isVisible: enabled && !getUsdbPrivacyWarningAcknowledged(persistentState),
    acknowledge,
  }
}
