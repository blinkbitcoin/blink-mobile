import React from "react"

import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getWalletIds } from "@app/graphql/wallets-utils"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useExportTransactionsCsv } from "@app/custodial/hooks/use-export-transactions-csv"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useExportSelfCustodialTransactionsCsv } from "@app/self-custodial/hooks/use-export-transactions-csv"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { SettingsRow } from "../row"

export const ExportCsvSetting: React.FC = () => {
  const { activeAccount } = useAccountRegistry()

  if (activeAccount?.type === AccountType.SelfCustodial) {
    return <SelfCustodialExportCsvRow />
  }
  return <CustodialExportCsvRow />
}

const CustodialExportCsvRow: React.FC = () => {
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed })
  const walletIds = getWalletIds(data?.me?.defaultAccount?.wallets)

  const { exportCsv, loading: spinner } = useExportTransactionsCsv()

  const handleExportCsv = async () => {
    try {
      await exportCsv(walletIds)
    } catch (err: unknown) {
      reportError("export-csv", err)
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

const SelfCustodialExportCsvRow: React.FC = () => {
  const { LL } = useI18nContext()
  /** The row waits for the SDK connection rather than failing the tap: sdk is null only
   *  while the wallet is still connecting (or connection failed, where the whole screen
   *  already surfaces the error state). */
  const { sdk } = useSelfCustodialWallet()

  const { exportCsv, loading: spinner } = useExportSelfCustodialTransactionsCsv()

  const handleExportCsv = async () => {
    try {
      await exportCsv()
    } catch (err: unknown) {
      reportError("self-custodial-export-csv", err)
      toastShow({ message: LL.SettingsScreen.csvTransactionsError(), LL })
    }
  }

  return (
    <SettingsRow
      loading={!sdk}
      spinner={spinner}
      title={LL.common.csvExport()}
      leftGaloyIcon="menu"
      rightIcon={"download"}
      action={handleExportCsv}
    />
  )
}
