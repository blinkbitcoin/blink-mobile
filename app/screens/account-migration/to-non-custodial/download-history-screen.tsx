import React, { useCallback, useState } from "react"
import { Platform } from "react-native"

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
import { StepLayout } from "@app/components/step-layout"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

/** Android's share chooser reports success as soon as the user picks a target app, before
 *  that app saves or sends the file, so a cancelled Drive or Gmail upload still reads as
 *  a download. iOS reports from the activity's own completion, so only Android keeps a way
 *  to download again once the primary CTA has moved on to Continue. */
const canRedownloadAfterExport = (): boolean => Platform.OS === "android"

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

  const handleDownload = useCallback(async () => {
    setIsDownloading(true)
    try {
      /** A dismissed share sheet resolves false: not an error, but not a download
       *  either, so the screen stays on Download + Skip. */
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
    <StepLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={
              hasDownloaded
                ? LL.common.continue()
                : LL.AccountMigration.downloadHistoryDownloadCta()
            }
            loading={!hasDownloaded && isDownloading}
            disabled={hasDownloaded ? isBusy : isDownloadDisabled}
            onPress={hasDownloaded ? continuePastHistory : handleDownload}
            {...testProps("migration-download-history-cta")}
          />
          {/** Once the history is downloaded the primary CTA is the way forward, so the
           *  screen drops Skip rather than offering it twice. */}
          {!hasDownloaded && (
            <GaloySecondaryButton
              title={LL.common.skip()}
              disabled={isBusy}
              onPress={continuePastHistory}
              {...testProps("migration-download-history-continue")}
            />
          )}
          {hasDownloaded && canRedownloadAfterExport() && (
            <GaloySecondaryButton
              title={LL.AccountMigration.downloadHistoryDownloadCta()}
              loading={isDownloading}
              disabled={isDownloadDisabled}
              onPress={handleDownload}
              {...testProps("migration-download-history-redownload")}
            />
          )}
        </>
      }
    >
      <IconHero
        icon="clock"
        iconColor={colors.primary}
        title={LL.AccountMigration.downloadHistoryTitle()}
        subtitle={LL.AccountMigration.downloadHistoryBody()}
      />
    </StepLayout>
  )
}
