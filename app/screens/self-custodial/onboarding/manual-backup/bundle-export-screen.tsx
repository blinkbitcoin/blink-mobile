import React, { useCallback, useState } from "react"
import { Linking } from "react-native"

import { useFocusEffect } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { IconHero } from "@app/components/icon-hero"
import { UNILATERAL_EXIT_CASE_STUDY_URL } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../layouts"

/**
 * The emergency bundle: the file that lets a self-custodial user exit onchain
 * without Blink if the Spark operators go offline.
 *
 * Reached from Settings only. With a cloud backup the bundle is also uploaded
 * after every transaction; otherwise it lives on this device, and either way
 * this screen hands over the copy saved here.
 */
export const BundleExportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { bundleState, sharing, reloadState, handleShare } = useRecoveryBundleActions()

  const [confirmingDownload, setConfirmingDownload] = useState(false)
  /** Only controls whether the warning is repeated. */
  const [hasDownloaded, setHasDownloaded] = useState(false)

  /** Re-read on focus: a bundle refreshed after a transaction while the
   *  screen was in the background is the one to hand over. */
  useFocusEffect(
    useCallback(() => {
      reloadState().catch(() => {})
    }, [reloadState]),
  )

  /** A wallet that has never held funds has no bundle to hand over yet. */
  const hasBundle = Boolean(bundleState)

  /** The warning is shown once, before the first download. */
  const onDownloadPress = useCallback(async () => {
    if (hasDownloaded) {
      await handleShare()
      return
    }
    setConfirmingDownload(true)
  }, [hasDownloaded, handleShare])

  const onConfirmDownload = useCallback(async () => {
    setConfirmingDownload(false)
    const didShare = await handleShare()
    if (didShare) setHasDownloaded(true)
  }, [handleShare])

  return (
    <OnboardingScreenLayout
      scrollable
      footer={
        <GaloyPrimaryButton
          title={LL.BackupScreen.BundleExport.download()}
          onPress={onDownloadPress}
          loading={sharing}
          disabled={!hasBundle}
          {...testProps("bundle-download-button")}
        />
      }
    >
      <IconHero
        icon="emergency-kit"
        iconColor={colors._green}
        title={LL.BackupScreen.BundleExport.title()}
        subtitle={LL.BackupScreen.BundleExport.body()}
      />

      <Text
        type="p2"
        style={styles.learnMore}
        onPress={() => Linking.openURL(UNILATERAL_EXIT_CASE_STUDY_URL)}
        {...testProps("bundle-learn-more")}
      >
        {LL.BackupScreen.BundleExport.learnMore()}
      </Text>

      <CustomModal
        isVisible={confirmingDownload}
        toggleModal={() => setConfirmingDownload(false)}
        showCloseIconButton={true}
        image={<GaloyIcon name="eye-slash" size={52} color={colors.primary} />}
        title={LL.BackupScreen.BundleExport.sensitiveTitle()}
        body={
          <Text type="p2" style={styles.modalBody}>
            {LL.BackupScreen.BundleExport.sensitiveBody()}
          </Text>
        }
        primaryButtonTitle={LL.BackupScreen.BundleExport.sensitiveConfirm()}
        primaryButtonOnPress={onConfirmDownload}
        primaryButtonLoading={sharing}
      />
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  learnMore: {
    paddingTop: 10,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  modalBody: {
    textAlign: "center",
  },
}))
