import React, { useCallback, useEffect, useState } from "react"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

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
 *
 * Skipping is allowed. It does not leave the user unprotected: the encrypted
 * on-device copy is written automatically for every self-custodial account
 * regardless, and the home-screen nudge brings them back once a bundle exists.
 * What is mandatory is that a backup exists, not that the user exports it here.
 */
export const BundleExportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { successMessage } = useRoute<BundleExportRouteProp>().params ?? {}
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialBackupBundleExport">
    >()

  const { bundleState, sharing, copying, reloadState, handleShare, handleCopy } =
    useRecoveryBundleActions()

  const [confirmingDownload, setConfirmingDownload] = useState(false)
  const [showLearnMore, setShowLearnMore] = useState(false)
  /** Only controls whether the warning is repeated, not whether the user may
   *  move on. */
  const [hasDownloaded, setHasDownloaded] = useState(false)

  useEffect(() => {
    reloadState().catch(() => {})
  }, [reloadState])

  const completeBackup = useCompleteBackup()

  const finish = useCallback(() => {
    logSelfCustodialBackupCompleted({ backupMethod: "manual" })
    completeBackup({ method: BackupMethod.Manual, message: successMessage })
  }, [completeBackup, successMessage])

  /** A completed download gets its own confirmation screen, which then finishes
   *  the backup; every other route finishes here directly. */
  const onDownloaded = useCallback(() => {
    navigation.navigate("selfCustodialBundleSaved", { successMessage })
  }, [navigation, successMessage])

  /** The warning is shown once, before the first export; a user who has already
   *  read it and comes back for the clipboard copy does not need it again. */
  const onDownloadPress = useCallback(async () => {
    if (hasDownloaded) {
      await handleShare()
      onDownloaded()
      return
    }
    setConfirmingDownload(true)
  }, [hasDownloaded, handleShare, onDownloaded])

  const onConfirmDownload = useCallback(async () => {
    setConfirmingDownload(false)
    await handleShare()
    setHasDownloaded(true)
    onDownloaded()
  }, [handleShare, onDownloaded])

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
              onPress={handleCopy}
              loading={copying}
              disabled={sharing}
              {...testProps("bundle-copy-button")}
            />
            <GaloySecondaryButton
              title={LL.BackupScreen.BundleExport.skip()}
              onPress={finish}
              {...testProps("bundle-skip-button")}
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
        icon="emergency-kit"
        iconColor={colors._green}
        title={LL.BackupScreen.BundleExport.title()}
        subtitle={
          hasBundle
            ? LL.BackupScreen.BundleExport.subtitle()
            : LL.BackupScreen.BundleExport.subtitlePending()
        }
      />

      {hasBundle && (
        <Text
          style={styles.learnMore}
          onPress={() => setShowLearnMore(true)}
          {...testProps("bundle-learn-more")}
        >
          {LL.BackupScreen.BundleExport.learnMore()}
        </Text>
      )}

      <CustomModal
        isVisible={confirmingDownload}
        toggleModal={() => setConfirmingDownload(false)}
        showCloseIconButton={true}
        image={<GaloyIcon name="eye-slash" size={52} color={colors.primary} />}
        title={LL.BackupScreen.BundleExport.sensitiveTitle()}
        body={
          <Text style={styles.modalBody}>
            {LL.BackupScreen.BundleExport.sensitiveBody()}
          </Text>
        }
        primaryButtonTitle={LL.BackupScreen.BundleExport.sensitiveConfirm()}
        primaryButtonOnPress={onConfirmDownload}
        primaryButtonLoading={sharing}
      />

      <CustomModal
        isVisible={showLearnMore}
        toggleModal={() => setShowLearnMore(false)}
        showCloseIconButton={true}
        title={LL.BackupScreen.BundleExport.learnMoreTitle()}
        body={
          <Text style={styles.modalBody}>
            {LL.BackupScreen.BundleExport.learnMoreBody()}
          </Text>
        }
        primaryButtonTitle={LL.common.ok()}
        primaryButtonOnPress={() => setShowLearnMore(false)}
      />
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  learnMore: {
    marginTop: 24,
    textAlign: "center",
    textDecorationLine: "underline",
    fontSize: 16,
    lineHeight: 24,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: colors.black,
  },
}))
