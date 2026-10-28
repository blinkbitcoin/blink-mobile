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
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

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
  /** Read and found nothing, as opposed to still reading. */
  const isBundleMissing = bundleState === null

  /** The warning is shown once, before the first download. Without a bundle
   *  the button only looks inactive: a tap says why there is nothing yet. */
  const onDownloadPress = useCallback(async () => {
    if (isBundleMissing) {
      toastShow({
        message: LL.RecoveryBundleScreen.noBundleToExport(),
        type: "warning",
        LL,
      })
      return
    }
    if (!hasBundle) return
    if (hasDownloaded) {
      await handleShare()
      return
    }
    setConfirmingDownload(true)
  }, [isBundleMissing, hasBundle, hasDownloaded, handleShare, LL])

  const onConfirmDownload = useCallback(async () => {
    setConfirmingDownload(false)
    const didShare = await handleShare()
    if (didShare) setHasDownloaded(true)
  }, [handleShare])

  /** The system browser can refuse to open, and a tap that silently does
   *  nothing reads as a broken link, so a refusal is said and reported. */
  const openCaseStudy = useCallback(async () => {
    try {
      await Linking.openURL(UNILATERAL_EXIT_CASE_STUDY_URL)
    } catch (err) {
      reportError("Emergency exit case study link", err)
      toastShow({ message: LL.errors.generic(), LL })
    }
  }, [LL])

  return (
    <OnboardingScreenLayout
      scrollable
      footer={
        <GaloyPrimaryButton
          title={LL.BackupScreen.BundleExport.download()}
          onPress={onDownloadPress}
          loading={sharing}
          {...(hasBundle
            ? {}
            : { buttonStyle: styles.inactiveButton, titleStyle: styles.inactiveTitle })}
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
        onPress={openCaseStudy}
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

/** GaloyPrimaryButton's disabled look, on a button that still takes the tap. */
const useStyles = makeStyles(({ colors }) => ({
  inactiveButton: {
    minHeight: 50,
    opacity: 0.5,
    backgroundColor: colors.primary,
  },
  inactiveTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.grey5,
  },
  learnMore: {
    paddingTop: 10,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  modalBody: {
    textAlign: "center",
  },
}))
