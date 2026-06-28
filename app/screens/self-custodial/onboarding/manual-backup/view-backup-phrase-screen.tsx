import React, { useCallback, useLayoutEffect } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { Card } from "@app/components/card"
import { headerRightNoGlass } from "@app/components/header-no-glass/header-no-glass"
import { InfoBanner } from "@app/components/info-banner"
import { MnemonicWordsGrid } from "@app/components/mnemonic-words-grid"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useBiometricGate } from "@app/screens/card-screen/hooks/use-biometric-gate"
import { testProps } from "@app/utils/testProps"

import { useViewBackupPhrase } from "../hooks"

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

  const { words, handleCopy, handleOpenSparkLink, handleTestBackup } =
    useViewBackupPhrase()

  const copyLabel = LL.BackupScreen.ManualBackup.Phrase.copy()

  useLayoutEffect(() => {
    navigation.setOptions(
      headerRightNoGlass(() => (
        <GaloyTertiaryButton
          clear
          title={copyLabel}
          onPress={handleCopy}
          containerStyle={styles.headerButton}
          {...testProps("backup-phrase-copy")}
        />
      )),
    )
  }, [navigation, copyLabel, handleCopy, styles])

  const sparkLink = LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()
  const infoText = LL.BackupScreen.ManualBackup.Phrase.sparkCompatible({
    sparkCompatibleLink: sparkLink,
  })
  const [infoBefore, infoAfter] = infoText.split(sparkLink)

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
        <Card
          type="warning"
          title={LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()}
        />

        <MnemonicWordsGrid words={words} />

        <InfoBanner>
          <Text style={styles.infoText}>
            {infoBefore}
            <Text
              style={styles.linkText}
              accessibilityRole="link"
              onPress={handleOpenSparkLink}
            >
              {sparkLink}
            </Text>
            {infoAfter}
          </Text>
        </InfoBanner>
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
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  linkText: {
    fontSize: 12,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
