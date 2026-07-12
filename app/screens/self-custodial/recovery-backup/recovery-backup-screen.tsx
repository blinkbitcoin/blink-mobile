import React, { useCallback } from "react"
import { ActivityIndicator, View } from "react-native"

import { useFocusEffect } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { InfoBanner } from "@app/components/info-banner"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  isCloudSeedBackupCompleted,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import { testProps } from "@app/utils/testProps"

import { getCloudProviderName } from "../onboarding/utils"
import { useRecoveryBundleActions } from "./use-recovery-bundle-actions"

export const RecoveryBackupScreen: React.FC = () => {
  const { LL, locale } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  // Cloud sync follows the seed backup: only offered once the user has backed
  // up their wallet to iCloud/Google Drive, and it targets the same provider.
  const { backupState } = useBackupState()
  const cloudSeedBackupActive = isCloudSeedBackupCompleted(backupState)

  const {
    bundleState,
    refreshing,
    uploading,
    exporting,
    reloadState,
    handleRefresh,
    handleShare,
    handleCopy,
    handleCloudUpload,
  } = useRecoveryBundleActions()

  useFocusEffect(
    useCallback(() => {
      reloadState().catch(() => {})
    }, [reloadState]),
  )

  const loading = bundleState === undefined
  const hasBundle = Boolean(bundleState)
  const formatWhen = (unixMs: number) => new Date(unixMs).toLocaleString(locale)

  return (
    <Screen preset="scroll">
      <View style={styles.container}>
        <View style={styles.heroContainer}>
          <IconHero
            icon="shield"
            iconColor={colors.primary}
            title={LL.RecoveryBundleScreen.title()}
            subtitle={LL.RecoveryBundleScreen.description()}
          />
        </View>

        <View style={styles.statusContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : bundleState ? (
            <>
              <Text type="p2">
                {LL.RecoveryBundleScreen.lastRefreshed({
                  when: formatWhen(bundleState.savedAt),
                })}
              </Text>
              <Text type="p2">
                {LL.RecoveryBundleScreen.leavesCovered({
                  count: bundleState.leafCount,
                })}
              </Text>
              {cloudSeedBackupActive && (
                <Text type="p2">
                  {bundleState.cloudSyncedAt
                    ? LL.RecoveryBundleScreen.cloudSynced({
                        when: formatWhen(bundleState.cloudSyncedAt),
                      })
                    : LL.RecoveryBundleScreen.cloudNotSynced()}
                </Text>
              )}
            </>
          ) : (
            <Text type="p2">{LL.RecoveryBundleScreen.noBundleYet()}</Text>
          )}
        </View>

        <View style={styles.bannerContainer}>
          <InfoBanner
            title={LL.RecoveryBundleScreen.exportWarningTitle()}
            icon="warning"
            iconColor="warning"
          >
            <Text type="p3">{LL.RecoveryBundleScreen.exportWarningMessage()}</Text>
          </InfoBanner>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.RecoveryBundleScreen.refreshNow()}
            loading={refreshing}
            onPress={handleRefresh}
            {...testProps("recovery-bundle-refresh")}
          />
          {cloudSeedBackupActive ? (
            <GaloySecondaryButton
              title={LL.RecoveryBundleScreen.uploadToCloud({
                provider: getCloudProviderName(LL),
              })}
              loading={uploading}
              disabled={!hasBundle}
              onPress={handleCloudUpload}
              {...testProps("recovery-bundle-cloud-upload")}
            />
          ) : (
            <Text type="p3" style={styles.cloudHint}>
              {LL.RecoveryBundleScreen.cloudFollowsSeedBackup({
                provider: getCloudProviderName(LL),
              })}
            </Text>
          )}
          <GaloySecondaryButton
            title={LL.RecoveryBundleScreen.exportFile()}
            loading={exporting}
            disabled={!hasBundle}
            onPress={handleShare}
            {...testProps("recovery-bundle-share")}
          />
          <GaloySecondaryButton
            title={LL.RecoveryBundleScreen.copyJson()}
            disabled={!hasBundle}
            onPress={handleCopy}
            {...testProps("recovery-bundle-copy")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  heroContainer: {
    paddingBottom: 10,
  },
  statusContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 4,
  },
  bannerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cloudHint: {
    textAlign: "center",
    paddingHorizontal: 10,
  },
}))
