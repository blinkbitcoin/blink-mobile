import { useMemo } from "react"

import { gql } from "@apollo/client"

import { createCustodialExportCsv } from "@app/custodial/adapters/export-csv"
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

/**
 * Wires the backend csvTransactions query into the custodial export adapter.
 * Resolves true when the share sheet completes and false when the user dismisses it;
 * a dismissal is a choice, not a failure, so only real errors reject.
 */
export const useExportTransactionsCsv = () => {
  const [fetchCsvTransactions, { loading }] = useExportCsvSettingLazyQuery({
    fetchPolicy: "network-only",
  })

  const exportCsv = useMemo(
    () =>
      createCustodialExportCsv(async (walletIds) => {
        const { data } = await fetchCsvTransactions({ variables: { walletIds } })
        return data?.me?.defaultAccount?.csvTransactions
      }),
    [fetchCsvTransactions],
  )

  return { exportCsv, loading }
}
