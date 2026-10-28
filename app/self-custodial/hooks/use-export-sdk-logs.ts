import { useState } from "react"
import { Platform } from "react-native"
import { getReadableVersion } from "react-native-device-info"

import { useAppConfig } from "@app/hooks/use-app-config"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"
import { shareTextFile } from "@app/utils/share-file"

import { networkLabelFor } from "../config"
import { SDK_LOG_EXPORT_BASENAME, exportSdkLogs } from "../diagnostics/export-sdk-logs"
import { buildLogExportHeader } from "../diagnostics/log-export-header"

import { useSelfCustodialAccountMode } from "./use-self-custodial-account-mode"
import { useSparkNetwork } from "./use-spark-network"

export const ExportLogsOutcome = {
  Shared: "shared",
  Dismissed: "dismissed",
  NoLogs: "noLogs",
} as const

export type ExportLogsOutcome = (typeof ExportLogsOutcome)[keyof typeof ExportLogsOutcome]

/**
 * Builds the SDK log export and opens the share sheet on it. Reads files only, so it
 * works while the SDK is disconnected or failed. Rejects only on real errors.
 *
 * The loading flag covers building the file only: a share target can hold the sheet
 * open indefinitely, and that must not pin the caller's spinner.
 */
export const useExportSdkLogs = () => {
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const network = useSparkNetwork()
  const { accountMode } = useSelfCustodialAccountMode()
  const { accounts } = useAccountRegistry()
  const [loading, setLoading] = useState(false)

  const exportLogs = async (): Promise<ExportLogsOutcome> => {
    setLoading(true)
    let path: string | null
    try {
      const now = new Date()
      const header = buildLogExportHeader({
        appVersion: getReadableVersion(),
        os: Platform.OS,
        osVersion: Platform.Version,
        network: networkLabelFor(network),
        accountMode,
        selfCustodialAccountCount: accounts.filter(
          (account) => account.type === AccountType.SelfCustodial,
        ).length,
        now,
      })
      path = await exportSdkLogs(header, now)
    } finally {
      setLoading(false)
    }
    if (path === null) return ExportLogsOutcome.NoLogs

    const shared = await shareTextFile(path, {
      title: SDK_LOG_EXPORT_BASENAME,
      subject: LL.support.defaultEmailSubject({ bankName: appConfig.galoyInstance.name }),
    })
    return shared ? ExportLogsOutcome.Shared : ExportLogsOutcome.Dismissed
  }

  return { exportLogs, loading }
}
