import React, { useLayoutEffect } from "react"
import { ActivityIndicator, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { PasswordInput } from "@app/components/password-input"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../layouts"

import { CloudBackupPicker } from "./cloud-backup-picker"
import { useCloudRestore } from "./hooks/use-cloud-restore"

export const SparkCloudRestoreScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const {
    isLoading,
    hasError,
    isNotFound,
    isPicker,
    isPassword,
    entries,
    password,
    setPassword,
    passwordError,
    loadCloudBackups,
    handlePick,
    handleDecrypt,
  } = useCloudRestore()

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isPicker ? LL.RestoreScreen.pickBackupTitle() : "",
    })
  }, [isPicker, navigation, LL])

  if (isLoading) {
    return (
      <OnboardingScreenLayout>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" {...testProps("restore-loading")} />
          <Text style={styles.loadingText}>{LL.RestoreScreen.restoring()}</Text>
        </View>
      </OnboardingScreenLayout>
    )
  }

  if (isNotFound || hasError) {
    return (
      <OnboardingScreenLayout
        footer={
          <>
            <GaloyPrimaryButton
              title={LL.RestoreScreen.restore()}
              onPress={() =>
                navigation.navigate("selfCustodialRestorePhrase", {
                  step: PhraseStep.First,
                })
              }
              {...testProps("try-manual-button")}
            />
            <GaloySecondaryButton
              title={LL.common.tryAgain()}
              onPress={loadCloudBackups}
              {...testProps("retry-download-button")}
            />
          </>
        }
      >
        <Text type="h1" style={styles.title} {...testProps("no-backup-title")}>
          {isNotFound
            ? LL.RestoreScreen.noBackupFound()
            : LL.RestoreScreen.restoreFailed()}
        </Text>
        {isNotFound && (
          <Text style={styles.description}>{LL.RestoreScreen.noBackupDescription()}</Text>
        )}
      </OnboardingScreenLayout>
    )
  }

  if (isPicker) {
    return (
      <OnboardingScreenLayout scrollable>
        <Text
          style={styles.pickerDescription}
          {...testProps("cloud-backup-picker-description")}
        >
          {LL.RestoreScreen.pickBackupDescription()}
        </Text>
        <CloudBackupPicker entries={entries} onSelect={handlePick} />
      </OnboardingScreenLayout>
    )
  }

  if (isPassword) {
    return (
      <OnboardingScreenLayout
        scrollable
        keyboardShouldPersistTaps="handled"
        footer={
          <GaloyPrimaryButton
            title={LL.RestoreScreen.restore()}
            disabled={password.length === 0}
            onPress={handleDecrypt}
            {...testProps("restore-decrypt-button")}
          />
        }
      >
        <Text type="h1" style={styles.title}>
          {LL.RestoreScreen.enterPassword()}
        </Text>
        <PasswordInput
          label={LL.BackupScreen.CloudBackup.password()}
          value={password}
          onChangeText={setPassword}
          error={passwordError ?? undefined}
          {...testProps("restore-password-input")}
        />
      </OnboardingScreenLayout>
    )
  }

  return null
}

const useStyles = makeStyles(({ colors }) => ({
  title: {
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
  },
  pickerDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
    marginTop: 10,
    marginBottom: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
}))
