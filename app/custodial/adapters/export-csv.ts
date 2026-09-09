import { CsvExportOutcome, exportCsvFile } from "@app/utils/export-csv-file"

/** Resolves the base64 CSV rendered by the backend, undefined when the field is
 *  missing from the response. */
export type FetchCsvTransactions = (walletIds: string[]) => Promise<string | undefined>

export type CustodialExportCsvAdapter = (walletIds: string[]) => Promise<CsvExportOutcome>

/**
 * Custodial CSV export: the backend renders the CSV from its ledger, the client only
 * delivers it. Resolves how the export reached the user; only real errors reject.
 */
export const createCustodialExportCsv =
  (fetchCsv: FetchCsvTransactions): CustodialExportCsvAdapter =>
  async (walletIds) => {
    const csvEncoded = await fetchCsv(walletIds)
    /** A missing field is a real failure, but an empty string is a valid empty export
     *  with no transactions: nothing to deliver rather than an error. */
    if (csvEncoded === undefined) {
      throw new Error("csvTransactions missing from the response")
    }
    if (csvEncoded === "") return "empty"
    return exportCsvFile(csvEncoded)
  }
