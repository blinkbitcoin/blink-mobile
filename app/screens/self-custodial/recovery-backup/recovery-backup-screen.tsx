import React, { useCallback, useState } from "react"
import { View } from "react-native"
import DeviceInfo from "react-native-device-info"
import Share from "react-native-share"

import crashlytics from "@react-native-firebase/crashlytics"
import { useFocusEffect } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { InfoBanner } from "@app/components/info-banner"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { networkLabelFor } from "@app/self-custodial/config"
import { getRecoveryBundleFilename } from "@app/self-custodial/recovery-bundle/cloud"
import {
  decryptBundleBackupPayload,
  parseBundleBackupMetadata,
} from "@app/self-custodial/recovery-bundle/encryption"
import {
  BackupMethod,
  BackupStatus,
  useBackupState,
} from "@app/self-custodial/providers/backup-state"
import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "@app/self-custodial/recovery-bundle/exporter"
import {
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "@app/self-custodial/recovery-bundle/refresh"
import {
  loadEncryptedBundleFile,
  readRecoveryBundleState,
  writeRecoveryBundleState,
  type RecoveryBundleState,
} from "@app/self-custodial/recovery-bundle/storage"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { AccountType } from "@app/types/wallet"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"
import { testProps } from "@app/utils/testProps"

import { usePlatformCloudBackup } from "../onboarding/hooks/use-platform-cloud-backup"
import { getCloudProviderName } from "../onboarding/utils"

export const RecoveryBackupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { copyToClipboard } = useClipboard()
  const { activeAccount } = useAccountRegistry()
  const network = useSparkNetwork()
  const cloudBackup = usePlatformCloudBackup()

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  // Cloud sync follows the seed backup: only offered once the user has backed
  // up their wallet to iCloud/Google Drive, and it targets the same provider.
  const { backupState } = useBackupState()
  const cloudSeedBackupActive =
    backupState.status === BackupStatus.Completed &&
    backupState.method === BackupMethod.Cloud

  const [bundleState, setBundleState] = useState<RecoveryBundleState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reloadState = useCallback(async () => {
    if (!accountId) return
    const state = await readRecoveryBundleState(accountId)
    setBundleState(state)
  }, [accountId])

  useFocusEffect(
    useCallback(() => {
      reloadState().catch(() => {})
    }, [reloadState]),
  )

  const handleRefresh = async () => {
    if (!accountId || refreshing) return
    setRefreshing(true)
    try {
      const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
      if (!mnemonic) {
        toastShow({ message: LL.RecoveryBundleScreen.refreshFailed(), LL })
        return
      }
      const result = await refreshRecoveryBundle({
        accountId,
        network,
        mnemonic,
        appVersion: DeviceInfo.getReadableVersion(),
      })
      if (result.success) {
        setBundleState(result.state)
        toastShow({
          message: LL.RecoveryBundleScreen.refreshSuccess(),
          type: "success",
          LL,
        })
        return
      }
      const emptyWallet =
        result.error instanceof RecoveryBundleExportError &&
        result.error.reason === RecoveryBundleExportErrorReason.NoLeaves
      toastShow({
        message: emptyWallet
          ? LL.RecoveryBundleScreen.refreshEmptyWallet()
          : LL.RecoveryBundleScreen.refreshFailed(),
        type: emptyWallet ? "warning" : "error",
        LL,
      })
    } finally {
      setRefreshing(false)
    }
  }

  /** Decrypts the saved bundle for export; requires the seed from the keystore. */
  const loadDecryptedBundleJson = async (): Promise<string | null> => {
    if (!accountId) return null
    const payload = await loadEncryptedBundleFile(accountId, network)
    if (!payload) {
      toastShow({ message: LL.RecoveryBundleScreen.noBundleToExport(), LL })
      return null
    }
    const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
    if (!mnemonic) {
      toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
      return null
    }
    const bundle = decryptBundleBackupPayload(payload, mnemonic)
    return JSON.stringify(bundle, null, 2)
  }

  const handleShare = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const json = await loadDecryptedBundleJson()
      if (!json) return
      await Share.open({
        title: "blink-recovery-bundle",
        filename: `blink-recovery-bundle-${networkLabelFor(network)}.json`,
        url: `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`,
        type: "application/json",
      })
    } catch (err) {
      if (err instanceof Error && !/User did not share/i.test(err.message)) {
        crashlytics().recordError(err)
        toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
      }
    } finally {
      setExporting(false)
    }
  }

  const handleCopy = async () => {
    try {
      const json = await loadDecryptedBundleJson()
      if (!json) return
      copyToClipboard({ content: json })
    } catch (err) {
      if (err instanceof Error) crashlytics().recordError(err)
      toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
    }
  }

  const handleCloudUpload = async () => {
    if (!accountId || uploading) return
    setUploading(true)
    try {
      // Silent path first (same provider the seed backup uses); fall back to
      // an interactive session when e.g. the Drive token needs a re-sign-in.
      const syncedSilently = await syncExistingBundleToCloud(accountId, network)
      if (syncedSilently) {
        await reloadState()
        toastShow({
          message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
          type: "success",
          LL,
        })
        return
      }

      const payload = await loadEncryptedBundleFile(accountId, network)
      if (!payload) {
        toastShow({ message: LL.RecoveryBundleScreen.noBundleToExport(), LL })
        return
      }
      const metadata = parseBundleBackupMetadata(payload)
      if (!metadata) {
        toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
        return
      }
      const fileName = getRecoveryBundleFilename(
        metadata.network,
        metadata.walletIdentityPublicKey,
      )

      const session = await cloudBackup.startSession(fileName)
      if (!session.success) {
        toastShow({ message: cloudBackup.resolveErrorMessage(session.reason, LL), LL })
        return
      }
      const upload = await cloudBackup.upload(payload, fileName, session.session)
      if (!upload.success) {
        toastShow({ message: cloudBackup.resolveErrorMessage(upload.reason, LL), LL })
        return
      }

      const current = (await readRecoveryBundleState(accountId)) ?? bundleState
      if (current) {
        const next = { ...current, cloudSyncedAt: Date.now() }
        await writeRecoveryBundleState(accountId, next)
        setBundleState(next)
      }
      toastShow({
        message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
        type: "success",
        LL,
      })
    } finally {
      setUploading(false)
    }
  }

  const hasBundle = bundleState !== null
  const formatWhen = (unixMs: number) => new Date(unixMs).toLocaleString()

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
          {hasBundle ? (
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
