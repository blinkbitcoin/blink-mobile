import React from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconTextButton } from "@app/components/icon-text-button"
import { InfoBanner } from "@app/components/info-banner"
import { MnemonicWordsGrid } from "@app/components/mnemonic-words-grid"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { useViewBackupPhrase } from "../hooks"

export const ViewBackupPhraseScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  useScreenSecurity()

  const { words, handleCopy, handleOpenSparkLink, handleTestBackup } =
    useViewBackupPhrase()

  const sparkLink = LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()
  const infoText = LL.BackupScreen.ManualBackup.Phrase.sparkCompatible({
    sparkCompatibleLink: sparkLink,
  })
  const [infoBefore, infoAfter] = infoText.split(sparkLink)

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.content}>
        <MnemonicWordsGrid words={words} />

        <IconTextButton
          icon="copy-paste"
          label={LL.BackupScreen.ManualBackup.Phrase.copy()}
          onPress={handleCopy}
          {...testProps("backup-phrase-copy")}
        />

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
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 20,
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
