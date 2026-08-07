import { useState } from "react"

import { shareCsvBase64 } from "@app/utils/share-csv"

import { createBuildTransactionsCsvBase64 } from "../adapters/export-csv"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Wires the connected SDK into the self-custodial export adapter and tracks an
 * in-flight flag for the settings row spinner. Same contract as the custodial hook:
 * true on share, false on dismissal or empty history, rejects only on real errors.
 *
 * The loading flag covers CSV generation only: a share target app can hold the intent
 * open indefinitely (seen with Google Drive on an unsynced account), and that must not
 * pin the settings row in its spinner state. The returned promise still resolves with
 * the share outcome for callers that consume it.
 */
export const useExportSelfCustodialTransactionsCsv = () => {
  const { sdk } = useSelfCustodialWallet()
  const [loading, setLoading] = useState(false)

  const exportCsv = async (): Promise<boolean> => {
    if (!sdk) throw new Error("Cannot export transactions: SDK is not connected")
    setLoading(true)
    let csvEncoded: string | null
    try {
      csvEncoded = await createBuildTransactionsCsvBase64(sdk)()
    } finally {
      setLoading(false)
    }
    if (csvEncoded === null) return false
    return shareCsvBase64(csvEncoded)
  }

  return { exportCsv, loading }
}
