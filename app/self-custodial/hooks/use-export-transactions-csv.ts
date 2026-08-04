import { useState } from "react"

import { createExportTransactionsCsv } from "../adapters/export-csv"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Wires the connected SDK into the self-custodial export adapter and tracks an
 * in-flight flag for the settings row spinner. Same contract as the custodial hook:
 * true on share, false on dismissal or empty history, rejects only on real errors.
 */
export const useExportSelfCustodialTransactionsCsv = () => {
  const { sdk } = useSelfCustodialWallet()
  const [loading, setLoading] = useState(false)

  const exportCsv = async (): Promise<boolean> => {
    if (!sdk) throw new Error("Cannot export transactions: SDK is not connected")
    setLoading(true)
    try {
      return await createExportTransactionsCsv(sdk)()
    } finally {
      setLoading(false)
    }
  }

  return { exportCsv, loading }
}
