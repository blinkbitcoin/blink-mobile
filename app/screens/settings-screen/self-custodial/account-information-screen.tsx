import React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import {
  BackupStatus,
  useBackupState,
} from "@app/self-custodial/providers/backup-state-provider"
import { testProps } from "@app/utils/testProps"

type CopyableFieldProps = {
  label: string
  value: string
  testID: string
}

const CopyableField: React.FC<CopyableFieldProps> = ({ label, value, testID }) => {
  const styles = useStyles()
  const { copyToClipboard } = useClipboard()

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
          {value}
        </Text>
        <TouchableOpacity
          onPress={() => copyToClipboard({ content: value })}
          hitSlop={8}
          {...testProps(`${testID}-copy`)}
        >
          <GaloyIcon name="copy-paste" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const backupStatusLabel = (
  status: BackupStatus,
  LL: ReturnType<typeof useI18nContext>["LL"],
): string => {
  if (status === BackupStatus.Completed) {
    return LL.SettingsScreen.AccountInformation.backupStatusCompleted()
  }
  return LL.SettingsScreen.AccountInformation.backupStatusNotCompleted()
}

export const SelfCustodialAccountInformationScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { identityPubkey, lightningAddress, loading, error } =
    useSelfCustodialAccountInfo()
  const { backupState } = useBackupState()

  const renderDetails = (): React.ReactNode => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      )
    }
    if (error) {
      return (
        <Text style={styles.errorText} {...testProps("account-info-error")}>
          {LL.SettingsScreen.AccountInformation.loadError()}
        </Text>
      )
    }
    return (
      <>
        <CopyableField
          label={LL.SettingsScreen.AccountInformation.identityLabel()}
          value={identityPubkey}
          testID="account-info-identity"
        />
        {lightningAddress ? (
          <CopyableField
            label={LL.SettingsScreen.AccountInformation.lightningAddressLabel()}
            value={lightningAddress}
            testID="account-info-lightning-address"
          />
        ) : null}
        <View style={styles.statusRow}>
          <Text style={styles.label}>
            {LL.SettingsScreen.AccountInformation.backupStatusLabel()}
          </Text>
          <Text style={styles.statusValue} {...testProps("account-info-backup-status")}>
            {backupStatusLabel(backupState.status, LL)}
          </Text>
        </View>
      </>
    )
  }

  return (
    <Screen preset="scroll" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>
          {LL.SettingsScreen.AccountInformation.accountTypeLabel()}
        </Text>
        <Text style={styles.sectionValue} {...testProps("self-custodial-account-type")}>
          {LL.AccountTypeSelectionScreen.selfCustodialLabel()}
        </Text>

        <View style={styles.divider} />

        {renderDetails()}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionLabel: {
    color: colors.grey2,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  sectionValue: {
    color: colors.black,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey5,
    marginVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey5,
    gap: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: {
    flex: 1,
    color: colors.black,
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    color: colors.grey2,
    fontSize: 13,
    lineHeight: 18,
  },
  statusValue: {
    color: colors.black,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
}))
