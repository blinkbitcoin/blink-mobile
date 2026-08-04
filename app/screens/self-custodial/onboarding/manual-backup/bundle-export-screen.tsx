import React, { useCallback, useEffect, useState } from "react"

import { RouteProp, useRoute } from "@react-navigation/native"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"
import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
import { testProps } from "@app/utils/testProps"

import { useCompleteBackup } from "../hooks"
import { OnboardingScreenLayout } from "../layouts"

type BundleExportRouteProp = RouteProp<
  RootStackParamList,
  "selfCustodialBackupBundleExport"
>

/**
 * The manual path's last step: hand over the recovery backup, the second
 * artifact a self-custodial user needs.
 *
 * Two states, because a wallet has no recovery backup until it has funds - the
 * exporter refuses to build one with no outputs to record. A brand-new account
 * therefore reaches this screen with nothing to download, and the honest thing
 * is to say so rather than hand over a file that would recover nothing. A
 * re-run of the backup on a funded wallet, or the migration path once the
 * transfer lands, reaches it with a real file.
 *
 * No cloud button here, deliberately (R7): a single cloud shortcut inside the
 * manual flow is what produces "I did the backup, it's in Google Drive" support
 * calls years later where only the bundle was ever saved.
 */
export const BundleExportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const { successMessage } = useRoute<BundleExportRouteProp>().params ?? {}

  const { bundleState, sharing, copying, reloadState, handleShare, handleCopy } =
    useRecoveryBundleActions()

  const [confirmingDownload, setConfirmingDownload] = useState(false)
  const [hasExported, setHasExported] = useState(false)

  useEffect(() => {
    reloadState().catch(() => {})
  }, [reloadState])

  const completeBackup = useCompleteBackup()

  const finish = useCallback(() => {
    logSelfCustodialBackupCompleted({ backupMethod: "manual" })
    completeBackup({ method: BackupMethod.Manual, message: successMessage })
  }, [completeBackup, successMessage])

  /** The warning is shown once, before the first export; a user who has already
   *  read it and comes back for the clipboard copy does not need it again. */
  const onDownloadPress = useCallback(() => {
    if (hasExported) {
      handleShare()
      return
    }
    setConfirmingDownload(true)
  }, [hasExported, handleShare])

  const onConfirmDownload = useCallback(async () => {
    setConfirmingDownload(false)
    await handleShare()
    setHasExported(true)
  }, [handleShare])

  const onCopyPress = useCallback(async () => {
    await handleCopy()
    setHasExported(true)
  }, [handleCopy])

  const isLoading = bundleState === undefined
  const hasBundle = Boolean(bundleState)

  return (
    <OnboardingScreenLayout
      footer={
        hasBundle ? (
          <>
            <GaloyPrimaryButton
              title={LL.BackupScreen.BundleExport.download()}
              onPress={onDownloadPress}
              loading={sharing}
              disabled={copying}
              {...testProps("bundle-download-button")}
            />
            <GaloySecondaryButton
              title={LL.BackupScreen.BundleExport.copy()}
              onPress={onCopyPress}
              loading={copying}
              disabled={sharing}
              {...testProps("bundle-copy-button")}
            />
            <GaloySecondaryButton
              title={LL.common.next()}
              onPress={finish}
              disabled={!hasExported}
              {...testProps("bundle-continue-button")}
            />
          </>
        ) : (
          <GaloyPrimaryButton
            title={LL.common.next()}
            onPress={finish}
            disabled={isLoading}
            {...testProps("bundle-continue-button")}
          />
        )
      }
    >
      <IconHero
        icon={hasBundle ? "eye-slash" : "shield"}
        iconColor={colors._green}
        title={LL.BackupScreen.BundleExport.title()}
        subtitle={
          hasBundle
            ? LL.BackupScreen.BundleExport.subtitle()
            : LL.BackupScreen.BundleExport.subtitlePending()
        }
      />

      <CustomModal
        isVisible={confirmingDownload}
        toggleModal={() => setConfirmingDownload(false)}
        showCloseIconButton={true}
        image={<GaloyIcon name="eye-slash" size={52} color={colors.primary} />}
        title={LL.BackupScreen.BundleExport.sensitiveTitle()}
        body={LL.BackupScreen.BundleExport.sensitiveBody()}
        primaryButtonTitle={LL.BackupScreen.BundleExport.download()}
        primaryButtonOnPress={onConfirmDownload}
        primaryButtonLoading={sharing}
      />
    </OnboardingScreenLayout>
  )
}
