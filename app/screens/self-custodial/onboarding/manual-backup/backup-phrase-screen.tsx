import React, { useEffect } from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"
import { useRoute, RouteProp } from "@react-navigation/native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconTextButton } from "@app/components/icon-text-button"
import { InfoBanner } from "@app/components/info-banner"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import {
  isPhraseStep,
  PhraseStep,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { SettingsGroup } from "@app/screens/settings-screen/group"

import { useBackupPhrase } from "../hooks"

const WORDS_PER_CARD = 3

type PhraseRouteProp = RouteProp<RootStackParamList, "selfCustodialBackupPhrase">

export const BackupPhraseScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  /** Deep links and navigation-state rehydration can deliver missing or malformed params
   *  despite the route type; a bare destructure here threw into the app-wide ErrorBoundary,
   *  replacing the whole navigation tree (#4070). Fall back to the first six words. */
  const stepParam = useRoute<PhraseRouteProp>().params?.step
  const hasValidStep = isPhraseStep(stepParam)
  const step = hasValidStep ? stepParam : PhraseStep.First

  useEffect(() => {
    if (hasValidStep) return
    reportError(
      "Backup phrase route params missing",
      new Error("Route delivered no valid step"),
      { dedupKey: "backup-phrase-params-missing", alwaysRecord: true },
    )
  }, [hasValidStep])

  useScreenSecurity()

  const {
    firstCard,
    secondCard,
    offset,
    handleCopy,
    handleOpenLink,
    handleContinue,
    buttonTitle,
    isButtonDisabled,
  } = useBackupPhrase(step)

  const sparkLink = LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()
  const infoText = LL.BackupScreen.ManualBackup.Phrase.sparkCompatible({
    sparkCompatibleLink: sparkLink,
  })
  const [infoBefore, infoAfter] = infoText.split(sparkLink)

  const renderWord = (word: string, index: number) => (
    <View key={index} style={styles.wordRow}>
      <Text style={styles.wordNumber}>{`${offset + index + 1}.  `}</Text>
      <Text style={styles.wordText}>{word}</Text>
    </View>
  )

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.seedWords}>
          <SettingsGroup
            items={firstCard.map((word, i) => () => renderWord(word, i))}
            containerStyle={styles.card}
            dividerStyle={styles.divider}
          />
          <SettingsGroup
            items={secondCard.map(
              (word, i) => () => renderWord(word, i + WORDS_PER_CARD),
            )}
            containerStyle={styles.card}
            dividerStyle={styles.divider}
          />
        </View>

        <InfoBanner>
          <Text style={styles.infoText}>
            {infoBefore}
            <Text
              style={styles.linkText}
              accessibilityRole="link"
              onPress={handleOpenLink}
            >
              {sparkLink}
            </Text>
            {infoAfter}
          </Text>
        </InfoBanner>

        <IconTextButton
          icon="copy-paste"
          label={LL.BackupScreen.ManualBackup.Phrase.copy()}
          onPress={handleCopy}
          {...testProps("backup-phrase-copy")}
        />
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={buttonTitle}
          disabled={isButtonDisabled}
          onPress={handleContinue}
          {...testProps("backup-phrase-continue")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 20,
  },
  seedWords: {
    gap: 20,
  },
  card: {
    borderRadius: 8,
    marginTop: 0,
  },
  divider: {
    marginHorizontal: 6,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 14,
  },
  wordNumber: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
  wordText: {
    fontSize: 14,
    lineHeight: 20,
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
