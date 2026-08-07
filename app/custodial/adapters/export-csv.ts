import { shareCsvBase64 } from "@app/utils/share-csv"

/** Resolves the base64 CSV rendered by the backend, undefined when the field is
 *  missing from the response. */
export type FetchCsvTransactions = (walletIds: string[]) => Promise<string | undefined>

export type CustodialExportCsvAdapter = (walletIds: string[]) => Promise<boolean>

/**
 * Custodial CSV export: the backend renders the CSV from its ledger, the client only
 * relays it to the share sheet. Resolves true when the sheet completes and false when
 * the user dismisses it or the export is empty; only real errors reject.
 */
export const createCustodialExportCsv =
  (fetchCsv: FetchCsvTransactions): CustodialExportCsvAdapter =>
  async (walletIds) => {
    const csvEncoded = await fetchCsv(walletIds)
    /** A missing field is a real failure, but an empty string is a valid empty export
     *  with no transactions: nothing to share rather than an error. */
    if (csvEncoded === undefined) {
      throw new Error("csvTransactions missing from the response")
    }
    if (csvEncoded === "") return false
    return shareCsvBase64(csvEncoded)
  }
