import * as React from "react"

import { PayoutSpeed } from "@app/graphql/generated"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { useEstimatedPayoutTime } from "@app/config/feature-flags-context"
import { useExpirationTimeLabel } from "@app/components/expiration-time-chooser"

export const DEFAULT_FAST_PAYOUT_MINUTES = 10

export const usePayoutSpeedText = (LL: TranslationFunctions) => {
  const mediumPayoutTime = useEstimatedPayoutTime(PayoutSpeed.Medium)
  const slowPayoutTime = useEstimatedPayoutTime(PayoutSpeed.Slow)

  const getExpirationTimeLabel = useExpirationTimeLabel(LL)

  const getPayoutSpeedDescription = React.useCallback(
    (speed: PayoutSpeed): string => {
      switch (speed) {
        case PayoutSpeed.Fast:
          return LL.SendBitcoinScreen.estimatedPayoutTime({
            time: `${DEFAULT_FAST_PAYOUT_MINUTES} ${LL.common.minutes()} (${LL.common.nextBlock()})`,
          })
        case PayoutSpeed.Medium:
          return LL.SendBitcoinScreen.estimatedPayoutTime({
            time: getExpirationTimeLabel({ minutes: mediumPayoutTime }),
          })
        case PayoutSpeed.Slow:
          return LL.SendBitcoinScreen.estimatedPayoutTime({
            time: getExpirationTimeLabel({ minutes: slowPayoutTime }),
          })
      }
    },
    [
      LL.SendBitcoinScreen,
      LL.common,
      getExpirationTimeLabel,
      mediumPayoutTime,
      slowPayoutTime,
    ],
  )

  const getPayoutSpeedName = React.useCallback(
    (speed?: PayoutSpeed) => {
      switch (speed) {
        case PayoutSpeed.Fast:
          return LL.common.payoutSpeed.fast.name()
        case PayoutSpeed.Medium:
          return LL.common.payoutSpeed.medium.name()
        case PayoutSpeed.Slow:
          return LL.common.payoutSpeed.slow.name()
        default:
          return LL.SendBitcoinScreen.selectFee()
      }
    },
    [LL.common.payoutSpeed, LL.SendBitcoinScreen],
  )

  return { getPayoutSpeedDescription, getPayoutSpeedName }
}
