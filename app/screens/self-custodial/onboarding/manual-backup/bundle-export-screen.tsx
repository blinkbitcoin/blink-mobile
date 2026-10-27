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
import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../layouts"

type BundleExportRouteProp = RouteProp<
  RootStackParamList,
  "selfCustodialBackupBundleExport"
>

/** Both exports put the decrypted bundle outside the app, so both sit behind
 *  the same sensitive-data confirmation. */
const ExportAction = {
  Download: "download",
  Copy: "copy",
} as const

type ExportAction = (typeof ExportAction)[keyof typeof ExportAction]

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
  const { successMessage, reBackup } = useRoute<BundleExportRouteProp>().params ?? {}
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialBackupBundleExport">
    >()

  const { bundleState, sharing, copying, reloadState, handleShare, handleCopy } =
    useRecoveryBundleActions()

  const [requestedExport, setRequestedExport] = useState<ExportAction>(
    ExportAction.Download,
  )
  const [isWarningVisible, setIsWarningVisible] = useState(false)
  const [showLearnMore, setShowLearnMore] = useState(false)
  /** Only controls whether the warning is repeated, not whether the user may
   *  move on. */
  const [isWarningAcknowledged, setIsWarningAcknowledged] = useState(false)

  useEffect(() => {
    reloadState().catch(() => {})
  }, [reloadState])

  /** The backup was recorded before this screen, so leaving it only navigates. */
  const finish = useCallback(() => {
    navigation.replace("selfCustodialBackupSuccess", {
      reBackup,
      message: successMessage,
    })
  }, [navigation, reBackup, successMessage])

  /** The flow advances only on a share that actually happened: a dismissed
   *  sheet would otherwise confirm an emergency file that never left the
   *  device, which is the one thing this screen exists to guarantee. */
  const download = useCallback(async () => {
    const didShare = await handleShare()
    if (didShare)
      navigation.navigate("selfCustodialBundleSaved", { successMessage, reBackup })
  }, [handleShare, navigation, successMessage, reBackup])

  const runExport = useCallback(
    (action: ExportAction) =>
      action === ExportAction.Download ? download() : handleCopy(),
    [download, handleCopy],
  )

  /** The warning is shown once, before the first export of either kind; a user
   *  who has read it does not need it again for the other one. */
  const requestExport = useCallback(
    async (action: ExportAction) => {
      if (isWarningAcknowledged) {
        await runExport(action)
        return
      }
      setRequestedExport(action)
      setIsWarningVisible(true)
    },
    [isWarningAcknowledged, runExport],
  )

  const onConfirmExport = useCallback(async () => {
    setIsWarningVisible(false)
    setIsWarningAcknowledged(true)
    await runExport(requestedExport)
  }, [requestedExport, runExport])

  const isLoading = bundleState === undefined
  const hasBundle = Boolean(bundleState)
  const isExporting = sharing || copying

  const subtitle = hasBundle
    ? LL.BackupScreen.BundleExport.subtitle()
    : LL.BackupScreen.BundleExport.subtitlePending()

  const confirmTitle =
    requestedExport === ExportAction.Copy
      ? LL.BackupScreen.BundleExport.copy()
      : LL.BackupScreen.BundleExport.sensitiveConfirm()

  const exportActions = (
    <>
      <GaloyPrimaryButton
        title={LL.BackupScreen.BundleExport.download()}
        onPress={() => requestExport(ExportAction.Download)}
        loading={sharing}
        disabled={copying}
        {...testProps("bundle-download-button")}
      />
      <GaloySecondaryButton
        title={LL.BackupScreen.BundleExport.copy()}
        onPress={() => requestExport(ExportAction.Copy)}
        loading={copying}
        disabled={sharing}
        {...testProps("bundle-copy-button")}
      />
      {/* Leaving this live during an export would finish the backup and
          navigate away while the share sheet or the clipboard write is still
          resolving into a screen the user has left. */}
      <GaloySecondaryButton
        title={LL.BackupScreen.BundleExport.skip()}
        onPress={finish}
        disabled={isExporting}
        {...testProps("bundle-skip-button")}
      />
    </>
  )

  const continueAction = (
    <GaloyPrimaryButton
      title={LL.common.next()}
      onPress={finish}
      disabled={isLoading}
      {...testProps("bundle-continue-button")}
    />
  )

  const footer = hasBundle ? exportActions : continueAction

  return (
    <OnboardingScreenLayout footer={footer}>
      <IconHero
        icon="emergency-kit"
        iconColor={colors._green}
        title={LL.BackupScreen.BundleExport.title()}
        subtitle={subtitle}
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
        isVisible={isWarningVisible}
        toggleModal={() => setIsWarningVisible(false)}
        showCloseIconButton={true}
        image={<GaloyIcon name="eye-slash" size={52} color={colors.primary} />}
        title={LL.BackupScreen.BundleExport.sensitiveTitle()}
        body={
          <Text style={styles.modalBody}>
            {LL.BackupScreen.BundleExport.sensitiveBody()}
          </Text>
        }
        primaryButtonTitle={confirmTitle}
        primaryButtonOnPress={onConfirmExport}
        primaryButtonLoading={isExporting}
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
