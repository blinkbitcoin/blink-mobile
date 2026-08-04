import { gql } from "@apollo/client"

import { useExportCsvSettingLazyQuery } from "@app/graphql/generated"
import { shareCsvBase64 } from "@app/utils/share-csv"

gql`
  query ExportCsvSetting($walletIds: [WalletId!]!) {
    me {
      id
      defaultAccount {
        id
        csvTransactions(walletIds: $walletIds)
      }
    }
  }
`

/**
 * Fetches the backend-rendered transaction CSV and opens the native share sheet.
 * Resolves true when the sheet completes and false when the user dismisses it; a
 * dismissal is a choice, not a failure, so only real errors reject.
 */
export const useExportTransactionsCsv = () => {
  const [fetchCsvTransactions, { loading }] = useExportCsvSettingLazyQuery({
    fetchPolicy: "network-only",
  })

  const exportCsv = async (walletIds: string[]): Promise<boolean> => {
    const { data } = await fetchCsvTransactions({ variables: { walletIds } })
    const csvEncoded = data?.me?.defaultAccount?.csvTransactions
    /** A missing field is a real failure, but an empty string is a valid empty export with
     *  no transactions: nothing to share rather than an error, so it resolves false. */
    if (csvEncoded === undefined) {
      throw new Error("csvTransactions missing from the response")
    }
    if (csvEncoded === "") return false
    return shareCsvBase64(csvEncoded)
  }

  return { exportCsv, loading }
}
