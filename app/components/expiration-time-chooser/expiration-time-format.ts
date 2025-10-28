import * as React from "react"

import type { TranslationFunctions } from "@app/i18n/i18n-types"

type Params = { minutes?: number }

export const useExpirationTimeLabel = (LL: TranslationFunctions) =>
  React.useCallback(
    (timeIn: Params): string => {
      const minutes = timeIn.minutes ?? 0
      if (minutes === 0) return ""

      const units = [
        { threshold: 1440, singular: LL.common.day.one(), plural: LL.common.day.other() },
        { threshold: 60, singular: LL.common.hour(), plural: LL.common.hours() },
        { threshold: 1, singular: LL.common.minute(), plural: LL.common.minutes() },
      ]

      for (const unit of units) {
        if (minutes >= unit.threshold) {
          const count = Math.floor(minutes / unit.threshold)
          return `${count} ${count === 1 ? unit.singular : unit.plural}`
        }
      }

      return `${minutes} ${LL.common.minutes()}`
    },
    [LL.common],
  )
