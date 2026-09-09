import { useState } from "react"

import { CsvExportOutcome, exportCsvFile } from "@app/utils/export-csv-file"

import { createBuildTransactionsCsvBase64 } from "../adapters/export-csv"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Wires the connected SDK into the self-custodial export adapter and tracks an
 * in-flight flag for the settings row spinner. Same contract as the custodial hook:
 * resolves how the export reached the user, rejects only on real errors.
 *
 * The loading flag covers CSV generation only: a share target app can hold the intent
 * open indefinitely (seen with Google Drive on an unsynced account), and that must not
 * pin the settings row in its spinner state. The returned promise still resolves with
 * the export outcome for callers that consume it.
 */
export const useExportSelfCustodialTransactionsCsv = () => {
  const { sdk } = useSelfCustodialWallet()
  const [loading, setLoading] = useState(false)

  const exportCsv = async (): Promise<CsvExportOutcome> => {
    if (!sdk) throw new Error("Cannot export transactions: SDK is not connected")
    setLoading(true)
    let csvEncoded: string | null
    try {
      csvEncoded = await createBuildTransactionsCsvBase64(sdk)()
    } finally {
      setLoading(false)
    }
    if (csvEncoded === null) return "empty"
    return exportCsvFile(csvEncoded)
  }

  return { exportCsv, loading }
}
