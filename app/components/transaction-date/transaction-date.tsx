import React from "react"
import { Text } from "react-native"

import { TxStatus } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { formatShortDate, isToday, isYesterday } from "@app/utils/date"

type TransactionDateProps = {
  createdAt: number
  includeTime: boolean
  status: TxStatus
}

export const formatDateForTransaction = ({
  createdAt,
  locale,
  timezone,
  now = Date.now(),
  includeTime,
}: {
  createdAt: number
  locale: string
  timezone?: string
  now?: number
  includeTime: boolean
}) => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  const diffInSeconds = Math.max(0, Math.floor((now - createdAt * 1000) / 1000))

  if (!includeTime && (isToday(createdAt) || isYesterday(createdAt))) {
    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, "second")
    }
    if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), "minute")
    }
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hour")
  }

  if (includeTime) {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: "full",
    }
    // forcing a timezone for the tests
    if (timezone) {
      options.timeZone = timezone
    }
    if (includeTime) {
      options.timeStyle = "medium"
    }

    return new Date(createdAt * 1000).toLocaleString(locale, options)
  }

  return formatShortDate({ createdAt, timezone })
}

export const TransactionDate = ({
  createdAt,
  status,
  includeTime,
}: TransactionDateProps) => {
  const { LL, locale } = useI18nContext()
  if (status === "PENDING") {
    return <Text>{LL.common.pending().toUpperCase()}</Text>
  }
  return <Text>{formatDateForTransaction({ createdAt, locale, includeTime })}</Text>
}
