import React, { useCallback, useLayoutEffect } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import {
  headerRightNoGlass,
  noHeaderRight,
} from "@app/components/header-no-glass"
import { WarningCard } from "@app/components/warning-card"
import { MnemonicWordsGrid } from "@app/components/mnemonic-words-grid"
import { Screen } from "@app/components/screen"
import { SparkCompatibleInfo } from "@app/components/spark-compatible-info"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useBiometricGate } from "@app/screens/card-screen/hooks/use-biometric-gate"
import { testProps } from "@app/utils/testProps"

import { useViewBackupPhrase } from "../hooks"

// The clear tertiary button has no padding, so its hit area is the text bounds.
const HEADER_BUTTON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

export const ViewBackupPhraseScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useScreenSecurity()

  const handleAuthFailure = useCallback(() => navigation.goBack(), [navigation])

  const authenticated = useBiometricGate({
    description: LL.BackupScreen.ManualBackup.Phrase.authDescription(),
    onFailure: handleAuthFailure,
    onlyIfBiometricsEnabled: true,
  })

  const { words, handleCopy, handleTestBackup } = useViewBackupPhrase()

  const copyLabel = LL.BackupScreen.ManualBackup.Phrase.copy()

  // The header sits outside the `!authenticated` early return below, so it has to
  // gate itself: without this the Copy button is mounted — and copies the full
  // mnemonic — while the biometric prompt is still pending.
  useLayoutEffect(() => {
    if (!authenticated) {
      navigation.setOptions(noHeaderRight)
      return
    }

    navigation.setOptions(
      headerRightNoGlass(() => (
        <GaloyTertiaryButton
          clear
          title={copyLabel}
          onPress={handleCopy}
          containerStyle={styles.headerButton}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          {...testProps("backup-phrase-copy")}
          accessibilityLabel={copyLabel}
        />
      )),
    )
  }, [navigation, authenticated, copyLabel, handleCopy, styles])

  if (!authenticated) {
    return (
      <Screen preset="fixed">
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    )
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.content}>
        <WarningCard title={LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()} />

        <MnemonicWordsGrid words={words} />

        <SparkCompatibleInfo />
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.BackupScreen.ManualBackup.Phrase.testBackup()}
          onPress={handleTestBackup}
          disabled={words.length === 0}
          {...testProps("test-backup-button")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 20,
  },
  headerButton: {
    marginRight: 16,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
