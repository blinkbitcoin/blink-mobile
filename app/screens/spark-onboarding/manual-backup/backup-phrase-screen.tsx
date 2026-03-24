import React, { useCallback, useRef } from "react"
import { Linking, ScrollView, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import InAppBrowser from "react-native-inappbrowser-reborn"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconTextButton } from "@app/components/icon-text-button"
import { InfoBanner } from "@app/components/info-banner"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useClipboard, useCountdown } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { formatDuration } from "@app/utils/date"
import { pickRandomIndices } from "@app/utils/helper"

import { MOCK_WORDS } from "../spark-mock-data"

const BIP39_MNEMONIC_WORD_COUNT = 12
const COUNTDOWN_SECONDS = 10
const CLIPBOARD_CLEAR_MS = 60_000

export const SparkBackupPhraseScreen: React.FC = () => {
  const { LL, locale } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const { sparkCompatibleWalletsUrl } = useRemoteConfig()

  const expiresAt = useRef(new Date(Date.now() + COUNTDOWN_SECONDS * 1000)).current
  const { remainingSeconds, isExpired } = useCountdown(expiresAt)

  const half = BIP39_MNEMONIC_WORD_COUNT / 2
  const firstHalf = MOCK_WORDS.slice(0, half)
  const secondHalf = MOCK_WORDS.slice(half)

  const handleCopy = useCallback(() => {
    copyToClipboard({
      content: MOCK_WORDS.join(" "),
      message: LL.SparkOnboarding.ManualBackup.Phrase.copiedToast(),
    })
  }, [copyToClipboard, LL])

  const handleOpenLink = () =>
    InAppBrowser.open(sparkCompatibleWalletsUrl).catch(() =>
      Linking.openURL(sparkCompatibleWalletsUrl),
    )

  const handleContinue = () => {
    const indices = pickRandomIndices(MOCK_WORDS.length, 3)
    const challenges = indices.map((i) => ({ index: i, word: MOCK_WORDS[i] }))
    navigation.navigate("sparkBackupConfirmScreen", { challenges })
  }

  const sparkLink = LL.SparkOnboarding.ManualBackup.Phrase.sparkCompatibleLink()
  const infoText = LL.SparkOnboarding.ManualBackup.Phrase.sparkCompatible({
    sparkCompatibleLink: sparkLink,
  })
  const [infoBefore, infoAfter] = infoText.split(sparkLink)

  const getButtonTitle = () => {
    if (!remainingSeconds) return LL.SparkOnboarding.ManualBackup.Phrase.savedConfirm()

    return `${LL.SparkOnboarding.ManualBackup.Phrase.saveItNow()} ${formatDuration(remainingSeconds, { unit: "second", locale })}`
  }

  const renderWord = (word: string, index: number) => (
    <View key={index} style={styles.wordRow}>
      <Text style={styles.wordNumber}>{`${index + 1}.  `}</Text>
      <Text style={styles.wordText}>{word}</Text>
    </View>
  )

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.seedWords}>
          <SettingsGroup
            items={firstHalf.map((word, i) => () => renderWord(word, i))}
            containerStyle={styles.card}
            dividerStyle={styles.divider}
          />
          <SettingsGroup
            items={secondHalf.map((word, i) => () => renderWord(word, i + 6))}
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
          label={LL.SparkOnboarding.ManualBackup.Phrase.copy()}
          onPress={handleCopy}
        />
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={getButtonTitle()}
          disabled={!isExpired}
          onPress={handleContinue}
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
