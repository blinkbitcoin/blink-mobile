import { type AccountMode } from "@app/types/account"

import { BREEZ_SDK_VERSION, type SparkNetworkLabel } from "../config"

export type LogExportHeaderFields = {
  appVersion: string
  os: string
  osVersion: string | number
  network: SparkNetworkLabel
  accountMode: AccountMode | null
  selfCustodialAccountCount: number
  now: Date
}

const pad = (value: number): string => String(Math.floor(value)).padStart(2, "0")

/** `UTC+02:00`: getTimezoneOffset is minutes *behind* UTC, so its sign is inverted. */
const utcOffset = (now: Date): string => {
  const minutesAhead = -now.getTimezoneOffset()
  const sign = minutesAhead < 0 ? "-" : "+"
  const abs = Math.abs(minutesAhead)
  return `UTC${sign}${pad(abs / 60)}:${pad(abs % 60)}`
}

/**
 * Context support needs to read the log, and nothing that identifies the user: no
 * pubkey, account id or Lightning address. The SDK lines below carry their own UTC
 * timestamps; the device offset lets support match them to what the user reports.
 */
export const buildLogExportHeader = ({
  appVersion,
  os,
  osVersion,
  network,
  accountMode,
  selfCustodialAccountCount,
  now,
}: LogExportHeaderFields): string =>
  [
    "Blink wallet logs",
    `Exported: ${now.toISOString()} (device time ${utcOffset(now)})`,
    `App: ${appVersion}`,
    `OS: ${os} ${osVersion}`,
    `Breez SDK: ${BREEZ_SDK_VERSION}`,
    `Network: ${network}`,
    `Account mode: ${accountMode ?? "not chosen"}`,
    `Self-custodial wallets on this device: ${selfCustodialAccountCount}`,
    "",
  ].join("\n")
