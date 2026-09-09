import { Platform } from "react-native"

import { reportError } from "./error-logging"
import { saveCsvToDownloads } from "./save-csv"
import { shareCsvBase64 } from "./share-csv"

/**
 * How the export reached the user:
 * - `saved` — written straight to the Downloads folder (Android).
 * - `shared` — handed to another app through the share sheet.
 * - `cancelled` — the user dismissed the share sheet.
 * - `empty` — there was nothing to export.
 */
export type CsvExportOutcome = "saved" | "shared" | "cancelled" | "empty"

/**
 * Delivers the base64 CSV by whichever route the platform calls a download.
 *
 * Android gets a real download into the Downloads folder; iOS keeps the share sheet,
 * which is where a file is saved there. If the Android write can't happen — a denied
 * storage grant, API 29's blocked raw paths, a full disk — the share sheet still runs,
 * so a failed download costs the user a tap rather than their export.
 */
export const exportCsvFile = async (csvEncoded: string): Promise<CsvExportOutcome> => {
  if (Platform.OS === "android") {
    try {
      const path = await saveCsvToDownloads(csvEncoded)
      if (path) return "saved"
    } catch (err) {
      reportError("csv download to the Downloads folder", err)
    }
  }

  return (await shareCsvBase64(csvEncoded)) ? "shared" : "cancelled"
}
