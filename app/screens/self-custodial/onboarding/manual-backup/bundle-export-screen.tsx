import React, { useCallback, useState } from "react"
import { Linking } from "react-native"

import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { IconHero } from "@app/components/icon-hero"
import { UNILATERAL_EXIT_CASE_STUDY_URL } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  isPasswordProtectedCloudSeedBackup,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import { useRecoveryBundleActions } from "@app/screens/self-custodial/recovery-backup/use-recovery-bundle-actions"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../layouts"

type BundleExportRouteProp = RouteProp<
  RootStackParamList,
  "selfCustodialBackupBundleExport"
>

const BundleScreenState = {
  /** Reached from the manual backup's Confirm step. */
  Onboarding: "onboarding",
  /** Settings entry while the bundle is not being uploaded to the cloud. */
  BackupsOff: "backups-off",
  /** Settings entry while the bundle is uploaded after every transaction. */
  BackupsOn: "backups-on",
} as const

type BundleScreenState = (typeof BundleScreenState)[keyof typeof BundleScreenState]

/**
 * The emergency bundle: the file that lets a self-custodial user exit onchain
 * without Blink if the Spark operators go offline.
 *
 * One screen, three states. Onboarding offers the cloud backup that keeps the
 * bundle current, or a skip. From Settings it either offers to turn those
 * backups on or, once they are on, hands over the latest bundle.
 *
 * "On" means the bundle is actually uploaded - a cloud seed backup with a
 * passphrase and bundle sync enabled - not merely that a cloud backup exists:
 * without the passphrase the bundle never leaves the device, and the copy would
 * promise an upload that is not happening.
 */
export const BundleExportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { fromOnboarding, successMessage } =
    useRoute<BundleExportRouteProp>().params ?? {}
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialBackupBundleExport">
    >()

  const { backupState } = useBackupState()
  const { bundleState, settings, sharing, reloadState, handleShare } =
    useRecoveryBundleActions()

  const [confirmingDownload, setConfirmingDownload] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  /** Only controls whether the warning is repeated. */
  const [hasDownloaded, setHasDownloaded] = useState(false)

  /** Re-read on focus: returning from the cloud backup flow can switch the
   *  screen from backups off to on. */
  useFocusEffect(
    useCallback(() => {
      reloadState().catch(() => {})
    }, [reloadState]),
  )

  const isLoading = bundleState === undefined
  const hasBundle = Boolean(bundleState)
  const isBundleSyncOn =
    isPasswordProtectedCloudSeedBackup(backupState) && settings.cloudSync

  const screenState: BundleScreenState = fromOnboarding
    ? BundleScreenState.Onboarding
    : isBundleSyncOn
      ? BundleScreenState.BackupsOn
      : BundleScreenState.BackupsOff

  const openCloudBackup = useCallback(() => {
    navigation.navigate("selfCustodialCloudBackup")
  }, [navigation])

  /** The backup was completed on the Confirm step; skipping only declines the
   *  cloud backup. Replaced so the success screen's back gesture cannot land here. */
  const skip = useCallback(() => {
    navigation.replace("selfCustodialBackupSuccess", { message: successMessage })
  }, [navigation, successMessage])

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

  const openCaseStudy = useCallback(() => {
    setShowHowItWorks(false)
    Linking.openURL(UNILATERAL_EXIT_CASE_STUDY_URL)
  }, [])

  const content = {
    [BundleScreenState.Onboarding]: {
      body: LL.BackupScreen.BundleExport.bodyOnboarding(),
      footer: (
        <>
          <GaloyPrimaryButton
            title={LL.BackupScreen.BundleExport.cloudBackup()}
            onPress={openCloudBackup}
            {...testProps("bundle-cloud-backup-button")}
          />
          <GaloySecondaryButton
            title={LL.BackupScreen.BundleExport.skip()}
            onPress={skip}
            {...testProps("bundle-skip-button")}
          />
        </>
      ),
    },
    [BundleScreenState.BackupsOff]: {
      body: LL.BackupScreen.BundleExport.bodyBackupsOff(),
      footer: (
        <GaloyPrimaryButton
          title={LL.BackupScreen.BundleExport.activateBackups()}
          onPress={openCloudBackup}
          {...testProps("bundle-activate-backups-button")}
        />
      ),
    },
    [BundleScreenState.BackupsOn]: {
      body: LL.BackupScreen.BundleExport.bodyBackupsOn(),
      footer: (
        /** A wallet that has never held funds has no bundle to hand over yet. */
        <GaloyPrimaryButton
          title={LL.BackupScreen.BundleExport.download()}
          onPress={onDownloadPress}
          loading={sharing}
          disabled={!hasBundle}
          {...testProps("bundle-download-button")}
        />
      ),
    },
  }[screenState]

  /** Settings states depend on stored settings, so they wait for the first read
   *  rather than flash "off" before turning "on". */
  const isResolved = fromOnboarding || !isLoading

  return (
    <OnboardingScreenLayout scrollable footer={isResolved ? content.footer : undefined}>
      <IconHero
        icon="emergency-kit"
        iconColor={colors._green}
        title={LL.BackupScreen.BundleExport.title()}
        subtitle={isResolved ? content.body : undefined}
      />

      <Text
        type="p2"
        style={styles.learnMore}
        onPress={() => setShowHowItWorks(true)}
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

      <CustomModal
        isVisible={showHowItWorks}
        toggleModal={() => setShowHowItWorks(false)}
        showCloseIconButton={true}
        title={LL.RecoveryBundleScreen.howItWorksTitle()}
        body={
          <Text type="p2" style={styles.modalBody}>
            {LL.RecoveryBundleScreen.howItWorksBody()}
          </Text>
        }
        primaryButtonTitle={LL.common.ok()}
        primaryButtonOnPress={() => setShowHowItWorks(false)}
        secondaryButtonTitle={LL.BackupScreen.BundleExport.readCaseStudy()}
        secondaryButtonOnPress={openCaseStudy}
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
