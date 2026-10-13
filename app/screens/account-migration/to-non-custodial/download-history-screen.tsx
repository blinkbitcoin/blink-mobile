import React, { useCallback, useState } from "react"

import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useExportTransactionsCsv } from "@app/custodial/hooks/use-export-transactions-csv"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  useCustodialWalletBalances,
  useMigrationNextStep,
} from "@app/screens/account-migration/hooks"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

export const MigrationDownloadHistoryScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  /** Continues through the same routing as every other step, so a commit point the server
   *  has since closed restarts from here instead of landing back on the commit screen. */
  const { continuePastHistory, loading: nextStepLoading } = useMigrationNextStep()

  const { walletIds, isReady: areWalletsReady } = useCustodialWalletBalances()

  const { exportCsv } = useExportTransactionsCsv()
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const isBusy = nextStepLoading || isDownloading
  /** The export needs the wallet ids, so Download waits for the balances query; Skip never
   *  does, so a still-loading or failed balances query can never trap the user on this
   *  optional step. Skip only waits on the routing's own reads, and a failed one answers
   *  the tap with a retry rather than holding the button off. */
  const isDownloadDisabled = isBusy || !areWalletsReady
  const secondaryButtonTitle = hasDownloaded ? LL.common.continue() : LL.common.skip()

  const handleDownload = useCallback(async () => {
    setIsDownloading(true)
    try {
      /** A dismissed share sheet resolves false: not an error, but not a download
       *  either, so the secondary action keeps reading Skip. */
      const hasShared = await exportCsv(walletIds)
      if (hasShared) setHasDownloaded(true)
    } catch (err) {
      reportError("Migration transaction history export", err)
      toastShow({ message: LL.SettingsScreen.csvTransactionsError(), LL })
    } finally {
      setIsDownloading(false)
    }
  }, [exportCsv, walletIds, LL])

  return (
    <MigrationStepLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.AccountMigration.downloadHistoryDownloadCta()}
            loading={isDownloading}
            disabled={isDownloadDisabled}
            onPress={handleDownload}
            {...testProps("migration-download-history-cta")}
          />
          <GaloySecondaryButton
            title={secondaryButtonTitle}
            disabled={isBusy}
            onPress={continuePastHistory}
            {...testProps("migration-download-history-continue")}
          />
        </>
      }
    >
      <IconHero
        icon="clock"
        iconColor={colors.primary}
        title={LL.AccountMigration.downloadHistoryTitle()}
        subtitle={LL.AccountMigration.downloadHistoryBody()}
      />
    </MigrationStepLayout>
  )
}
