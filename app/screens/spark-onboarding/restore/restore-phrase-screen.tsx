import React, { useLayoutEffect } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SuggestionBar } from "@app/components/suggestion-bar"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { MnemonicWordInput } from "@app/components/mnemonic-word-input"
import { OnboardingScreenLayout } from "../layouts"

import { RestoreStatus, useRestorePhrase } from "./hooks/use-restore-phrase"

type RestorePhraseRouteProp = RouteProp<RootStackParamList, "sparkRestorePhraseScreen">

export const SparkRestorePhraseScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { step, words: initialWords } = useRoute<RestorePhraseRouteProp>().params

  const {
    stepWords,
    offset,
    setActiveIndex,
    updateWord,
    handlePaste,
    handlePasteFromClipboard,
    suggestions,
    selectSuggestion,
    stepFilled,
    isValid,
    validationError,
    status,
    isStep1,
    handleContinue,
    handleRestore,
  } = useRestorePhrase({ step, initialWords })

  const pasteLabel = LL.RestoreScreen.paste()

  useLayoutEffect(() => {
    if (!isStep1) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handlePasteFromClipboard}
          style={styles.headerPaste}
          {...testProps("restore-paste-button")}
        >
          <Text style={styles.headerPasteText}>{pasteLabel}</Text>
        </Pressable>
      ),
    })
  }, [navigation, isStep1, handlePasteFromClipboard, pasteLabel, styles])

  if (status === RestoreStatus.Restoring) {
    return (
      <OnboardingScreenLayout>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText} {...testProps("restoring-text")}>
            {LL.RestoreScreen.restoring()}
          </Text>
        </View>
      </OnboardingScreenLayout>
    )
  }

  if (status === RestoreStatus.Error) {
    return (
      <OnboardingScreenLayout
        footer={
          <GaloyPrimaryButton
            title={LL.common.tryAgain()}
            onPress={handleRestore}
            {...testProps("restore-retry-button")}
          />
        }
      >
        <Text type="h1" {...testProps("restore-error-title")}>
          {LL.RestoreScreen.restoreFailed()}
        </Text>
      </OnboardingScreenLayout>
    )
  }

  const stepContent: Record<PhraseStep, { subtitle: string; button: string }> = {
    [PhraseStep.First]: {
      subtitle: LL.RestoreScreen.phraseSubtitleStep1(),
      button: LL.RestoreScreen.nextWords(),
    },
    [PhraseStep.Second]: {
      subtitle: LL.RestoreScreen.phraseSubtitleStep2(),
      button: LL.RestoreScreen.restore(),
    },
  }

  const { subtitle, button: buttonTitle } = stepContent[step]
  const buttonDisabled = isStep1 ? !stepFilled : !isValid

  return (
    <OnboardingScreenLayout
      scrollable
      keyboardShouldPersistTaps="handled"
      footer={
        <>
          <SuggestionBar suggestions={suggestions} onSelect={selectSuggestion} />
          <GaloyPrimaryButton
            title={buttonTitle}
            disabled={buttonDisabled}
            onPress={isStep1 ? handleContinue : handleRestore}
            {...testProps("restore-button")}
          />
        </>
      }
    >
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.inputList}>
        {stepWords.map((word, i) => {
          const globalIndex = offset + i
          return (
            <MnemonicWordInput
              key={globalIndex}
              index={globalIndex}
              value={word}
              placeholder={`${LL.RestoreScreen.enterWord()} ${globalIndex + 1}`}
              onChangeText={(text) => {
                if (globalIndex === 0 && handlePaste(text)) return
                updateWord(globalIndex, text)
              }}
              onFocus={() => setActiveIndex(globalIndex)}
              correct={!isStep1 && isValid}
              wrong={!isStep1 && Boolean(validationError)}
              testID={`restore-word-${globalIndex}`}
            />
          )
        })}
      </View>

      {validationError && (
        <Text style={styles.errorText} {...testProps("restore-error")}>
          {validationError}
        </Text>
      )}
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
    marginBottom: 20,
  },
  inputList: {
    gap: 10,
  },
  headerPaste: {
    marginRight: 16,
  },
  headerPasteText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: colors.red,
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
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
