/* eslint-disable no-param-reassign */

export const DEC_1_12_AM_UTC_MINUS_6 = new Date(Date.UTC(2023, 11, 1, 6, 0, 0)).getTime()

export const JAN_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 0, 1, 6, 0, 0),
).getTime()

export const FEB_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 1, 1, 6, 0, 0),
).getTime()

export const MAR_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 2, 1, 6, 0, 0),
).getTime()

export const APR_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 3, 1, 6, 0, 0),
).getTime()

export const MAY_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 4, 1, 6, 0, 0),
).getTime()

export const JUNE_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 5, 1, 6, 0, 0),
).getTime()

export const JULY_1_2024_12_AM_UTC_MINUS_6 = new Date(
  Date.UTC(2024, 6, 1, 6, 0, 0),
).getTime()

const secondsToDDMMSS = (totalSeconds: number) => {
  if (totalSeconds < 0) return ""

  const days = Math.floor(totalSeconds / 86400) // There are 86400 seconds in a day
  const hours = Math.floor((totalSeconds - days * 86400) / 3600) // 3600 seconds in an hour
  const minutes = Math.floor((totalSeconds - days * 86400 - hours * 3600) / 60)
  const seconds = Math.floor(totalSeconds - days * 86400 - hours * 3600 - minutes * 60)

  const formattedDays = days.toString().padStart(2, "0")
  const formattedHours = hours.toString().padStart(2, "0")
  const formattedMinutes = minutes.toString().padStart(2, "0")
  const formattedSeconds = seconds.toString().padStart(2, "0")

  return `${formattedDays}:${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

export const getTimeLeft = ({ after, until }: { after: number; until: number }) => {
  const dateNow = Date.now()
  if (dateNow > until || dateNow < after) return ""

  const sLeft = (until - dateNow) / 1000
  return secondsToDDMMSS(sLeft)
}

// e.g. 1747691078 -> "2025-05-19 15:44"
export function formatUnixTimestampYMDHM(timestampInSeconds: number) {
  return new Date(timestampInSeconds * 1000).toISOString().slice(0, 16).replace("T", " ")
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const isToday = (createdAt: number) =>
  isSameDay(new Date(createdAt * 1000), new Date())

export const isYesterday = (createdAt: number) =>
  isSameDay(new Date(createdAt * 1000), new Date(Date.now() - 86400000))

export const formatShortDate = ({
  createdAt,
  timezone,
}: {
  createdAt: number
  timezone?: string
}) => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }

  return new Date(createdAt * 1000).toLocaleDateString("en-CA", options)
}

export const parseCardValidThru = (
  value: string | Date,
): { month: string; year: string } | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = `${value.getMonth() + 1}`.padStart(2, "0")
    const year = `${value.getFullYear()}`.slice(-2)
    return { month, year }
  }

  const raw = `${value}`.trim()
  const parsed = Date.parse(raw)
  if (!Number.isNaN(parsed) && (raw.includes("-") || raw.includes("T"))) {
    const date = new Date(parsed)
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const year = `${date.getFullYear()}`.slice(-2)
    return { month, year }
  }

  return null
}

import { MASK_CHAR } from "@app/config/appinfo"

export const formatCardValidThruDisplay = (
  value: string | Date,
  showDetails: boolean,
  maskChar = MASK_CHAR,
) => {
  const parts = parseCardValidThru(value)
  if (!parts) return ""

  if (showDetails) return `${parts.month}/ ${parts.year}`.trim()

  return `${maskChar}${maskChar} / ${maskChar}${maskChar}`
}
