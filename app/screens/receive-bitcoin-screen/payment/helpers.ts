import { Network } from "@app/graphql/generated"
import {
  decodeInvoiceString,
  Network as NetworkLibGaloy,
} from "@blinkbitcoin/blink-client"

import { Invoice, GetFullUriInput } from "./index.types"

const prefixByType = {
  [Invoice.OnChain]: "bitcoin:",
  [Invoice.Lightning]: "lightning:",
  [Invoice.PayCode]: "",
}

export const getPaymentRequestFullUri = ({
  input,
  amount,
  memo,
  uppercase = false,
  prefix = true,
  type = Invoice.OnChain,
}: GetFullUriInput): string => {
  if (type === Invoice.Lightning) {
    return uppercase ? input.toUpperCase() : input
  }

  const uriPrefix = prefix ? prefixByType[type] : ""
  const uri = `${uriPrefix}${input}`
  const params = new URLSearchParams()

  if (amount) params.append("amount", `${satsToBTC(amount)}`)

  if (memo) {
    params.append("message", encodeURI(memo))
    return `${uri}?${params.toString()}`
  }

  return uri + (params.toString() ? "?" + params.toString() : "")
}

export const satsToBTC = (satsAmount: number): number => satsAmount / 10 ** 8

export const getDefaultMemo = (bankName: string) => {
  return `Pay to ${bankName} Wallet user`
}

export const secondsToH = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)

  const hDisplay = h > 0 ? h + "h" : ""

  return hDisplay
}

export const secondsToHMS = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const hDisplay = h > 0 ? h + "h" : ""
  const mDisplay = m > 0 ? m + "m" : ""
  const sDisplay = s > 0 ? s + "s" : ""

  return hDisplay + mDisplay + sDisplay
}

export const generateFutureLocalTime = (secondsToAdd: number): string => {
  const date = new Date() // Get current date
  date.setSeconds(date.getSeconds() + secondsToAdd) // Add seconds to the current date

  // Format to local time string
  const hours = date.getHours() % 12 || 12 // Get hours (12 hour format), replace 0 with 12
  const minutes = String(date.getMinutes()).padStart(2, "0") // Get minutes
  const period = date.getHours() >= 12 ? "PM" : "AM" // Get AM/PM

  return `${hours}:${minutes}${period}`
}

type TruncateMiddleOptions = {
  startChars?: number
  endChars?: number
  separator?: string
}

export const truncateMiddle = (
  text: string,
  { startChars = 10, endChars = 10, separator = "..." }: TruncateMiddleOptions = {},
): string => {
  if (!text || text.length <= startChars + endChars) return text ?? ""
  return `${text.slice(0, startChars)}${separator}${text.slice(-endChars)}`
}

export const prToDateString = (paymentRequest: string, network: Network) => {
  let dateString
  try {
    dateString = decodeInvoiceString(
      paymentRequest,
      network as NetworkLibGaloy,
    ).timeExpireDateString
  } catch (e) {
    console.error(e)
  }
  return dateString
}
