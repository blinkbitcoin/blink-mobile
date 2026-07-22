import { Platform } from "react-native"
import Share from "react-native-share"

import { gql } from "@apollo/client"

import { useExportCsvSettingLazyQuery } from "@app/graphql/generated"

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

const CSV_BASENAME = "blink-transactions"
const CSV_EXTENSION = "csv"
const CSV_MIME_TYPE = "text/csv"

/** Android's react-native-share appends the mime extension, iOS does not, so only iOS carries ".csv". */
const buildCsvFilename = (): string =>
  Platform.OS === "android" ? CSV_BASENAME : `${CSV_BASENAME}.${CSV_EXTENSION}`

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
    const result = await Share.open({
      title: CSV_BASENAME,
      filename: buildCsvFilename(),
      url: `data:${CSV_MIME_TYPE};base64,${csvEncoded}`,
      type: CSV_MIME_TYPE,
      failOnCancel: false,
    })
    return result.success
  }

  return { exportCsv, loading }
}
