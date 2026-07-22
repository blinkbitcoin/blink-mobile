import React from "react"

import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getWalletIds } from "@app/graphql/wallets-utils"
import { useExportTransactionsCsv } from "@app/hooks/use-export-transactions-csv"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"
import crashlytics from "@react-native-firebase/crashlytics"

import { SettingsRow } from "../row"

export const ExportCsvSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  const walletIds = getWalletIds(data?.me?.defaultAccount?.wallets)

  const { exportCsv, loading: spinner } = useExportTransactionsCsv()

  const handleExportCsv = async () => {
    try {
      await exportCsv(walletIds)
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
      }
      toastShow({ message: LL.SettingsScreen.csvTransactionsError(), LL })
    }
  }

  return (
    <SettingsRow
      loading={loading}
      spinner={spinner}
      title={LL.common.csvExport()}
      leftGaloyIcon="menu"
      rightIcon={"download"}
      action={handleExportCsv}
    />
  )
}
