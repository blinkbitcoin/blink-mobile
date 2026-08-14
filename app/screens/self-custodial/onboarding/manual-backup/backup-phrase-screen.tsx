import React, { useEffect, useLayoutEffect } from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { headerRightNoGlass } from "@app/components/header-no-glass"
import { WarningCard } from "@app/components/warning-card"
import { Screen } from "@app/components/screen"
import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { SparkCompatibleInfo } from "@app/components/spark-compatible-info"
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

// The clear tertiary button has no padding, so its hit area is the text bounds.
const HEADER_BUTTON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

type PhraseRouteProp = RouteProp<RootStackParamList, "selfCustodialBackupPhrase">

/** The gate mounts this only once the screenshot guard is actually on — the words
 *  and the header Copy action must not exist while registration is pending. */
const BackupPhraseContent: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

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

  const {
    firstCard,
    secondCard,
    offset,
    handleCopy,
    handleContinue,
    buttonTitle,
    isButtonDisabled,
  } = useBackupPhrase(step)

  const copyLabel = LL.BackupScreen.ManualBackup.Phrase.copy()

  useLayoutEffect(() => {
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
  }, [navigation, copyLabel, handleCopy, styles])

  const renderWord = (word: string, index: number) => (
    <View key={index} style={styles.wordRow}>
      <Text style={styles.wordNumber}>{`${offset + index + 1}.  `}</Text>
      <Text style={styles.wordText}>{word}</Text>
    </View>
  )

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.content}>
        <WarningCard title={LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()} />

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

        <SparkCompatibleInfo />
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

export const BackupPhraseScreen: React.FC = () => (
  <ScreenSecurityGate>
    <BackupPhraseContent />
  </ScreenSecurityGate>
)

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 20,
  },
  headerButton: {
    marginRight: 16,
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
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
