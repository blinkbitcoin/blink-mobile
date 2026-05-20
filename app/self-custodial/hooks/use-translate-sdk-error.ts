import { useCallback } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { SelfCustodialErrorCode } from "../sdk-error"

export const useTranslateSdkError = () => {
  const { LL } = useI18nContext()

  return useCallback(
    (raw: string | undefined): string | undefined => {
      if (!raw) return undefined
      switch (raw) {
        case SelfCustodialErrorCode.InsufficientFunds:
          return LL.SelfCustodialError.insufficientFunds()
        case SelfCustodialErrorCode.BelowMinimum:
          return LL.SelfCustodialError.belowMinimum()
        case SelfCustodialErrorCode.NetworkError:
          return LL.SelfCustodialError.networkError()
        case SelfCustodialErrorCode.InvalidInput:
          return LL.SelfCustodialError.invalidInput()
        case SelfCustodialErrorCode.Generic:
          return LL.SelfCustodialError.generic()
        default:
          return raw
      }
    },
    [LL],
  )
}
