import { type AccountMode } from "@app/types/account"

import { BREEZ_SDK_VERSION, type SparkNetworkLabel } from "../config"

export type LogExportHeaderFields = {
  appVersion: string
  os: string
  osVersion: string | number
  network: SparkNetworkLabel
  accountMode: AccountMode | null
  /** The install's analytics id, only when the user may share it (`shouldIncludeAnalyticsId`). */
  analyticsId: string | null
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
 * Context support needs to read the log: no pubkey, account id or Lightning address. The
 * one identifier it may carry is the install's analytics id, in Enhanced only, so support
 * can look up that install's app events for this one case (Telemetry PRD 2, R27, KB-26).
 * The user sends the file, so the link exists only in the case they open. The SDK lines
 * below carry their own UTC timestamps; the device offset lets support match them to
 * what the user reports.
 */
export const buildLogExportHeader = ({
  appVersion,
  os,
  osVersion,
  network,
  accountMode,
  analyticsId,
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
    ...(analyticsId ? [`Analytics ID: ${analyticsId}`] : []),
    `Self-custodial wallets on this device: ${selfCustodialAccountCount}`,
    "",
  ].join("\n")
