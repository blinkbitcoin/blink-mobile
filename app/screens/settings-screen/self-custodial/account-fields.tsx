import React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { testProps } from "@app/utils/testProps"

type FieldProps = {
  label: string
  value: string
  copyTestID?: string
  valueTestID?: string
}

const ReadOnlyField: React.FC<FieldProps> = ({
  label,
  value,
  copyTestID,
  valueTestID,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.box}>
        <Text
          style={styles.value}
          numberOfLines={1}
          ellipsizeMode="middle"
          {...(valueTestID ? testProps(valueTestID) : {})}
        >
          {value}
        </Text>
        {copyTestID ? <CopyButton value={value} testID={copyTestID} /> : null}
      </View>
    </View>
  )
}

const CopyButton: React.FC<{ value: string; testID: string }> = ({ value, testID }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { copyToClipboard } = useClipboard()
  return (
    <TouchableOpacity
      hitSlop={8}
      onPress={() => copyToClipboard({ content: value })}
      {...testProps(testID)}
    >
      <GaloyIcon name="copy-paste" size={16} color={colors.primary} />
    </TouchableOpacity>
  )
}

const backupStatusText = (
  status: BackupStatus,
  LL: ReturnType<typeof useI18nContext>["LL"],
): string => {
  if (status === BackupStatus.Completed) {
    return LL.SettingsScreen.AccountInformation.backupStatusCompleted()
  }
  return LL.SettingsScreen.AccountInformation.backupStatusNotCompleted()
}

export const SelfCustodialAccountFields: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { identityPubkey, lightningAddress, loading, error } =
    useSelfCustodialAccountInfo()
  const { backupState } = useBackupState()

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
    <View style={styles.list}>
      <ReadOnlyField
        label={LL.SettingsScreen.AccountInformation.identityLabel()}
        value={identityPubkey}
        copyTestID="account-info-identity-copy"
      />
      {lightningAddress ? (
        <ReadOnlyField
          label={LL.SettingsScreen.AccountInformation.lightningAddressLabel()}
          value={lightningAddress}
          copyTestID="account-info-lightning-address-copy"
        />
      ) : null}
      <ReadOnlyField
        label={LL.SettingsScreen.AccountInformation.backupStatusLabel()}
        value={backupStatusText(backupState.status, LL)}
        valueTestID="account-info-backup-status"
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  list: {
    gap: 20,
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
  fieldGroup: {
    gap: 3,
  },
  label: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 14,
    gap: 14,
  },
  value: {
    flex: 1,
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
  },
}))
