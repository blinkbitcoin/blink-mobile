import React, { useEffect, useLayoutEffect, useRef } from "react"
import { ActivityIndicator, View } from "react-native"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { headerRightNoGlass, noHeaderRight } from "@app/components/header-no-glass"
import { WarningCard } from "@app/components/warning-card"
import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { SuggestionBar } from "@app/components/suggestion-bar"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  isPhraseStep,
  PhraseStep,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

import {
  MnemonicWordInput,
  type MnemonicWordInputHandle,
} from "@app/components/mnemonic-word-input"
import { OnboardingScreenLayout } from "../layouts"
import { isValidStepTwoWords } from "../utils"

import { RestoreStatus, useRestorePhrase } from "./hooks/use-restore-phrase"

type RestorePhraseRouteProp = RouteProp<RootStackParamList, "selfCustodialRestorePhrase">

// The clear tertiary button has no padding, so its hit area is the text bounds.
const HEADER_BUTTON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

/** The gate mounts this only once the screenshot guard is actually on — the typed
 *  words and the header Paste action must not exist while registration is pending. */
const RestorePhraseContent: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Deep links and navigation-state rehydration can deliver missing or malformed params
   *  despite the route type; a bare destructure here threw into the app-wide ErrorBoundary,
   *  replacing the whole navigation tree (#4070). Fall back to step 1, where a restore
   *  starts anyway. Step 2 is only valid together with the words entered on step 1 —
   *  without them it renders inputs 7-12 over a phrase that can never validate. */
  const { params } = useRoute<RestorePhraseRouteProp>()
  const stepParam = params?.step
  const wordsParam = params?.words
  const wordsOk = isValidStepTwoWords(wordsParam)
  const hasValidParams =
    isPhraseStep(stepParam) && (stepParam === PhraseStep.First || wordsOk)
  const step = hasValidParams ? stepParam : PhraseStep.First
  const initialWords = hasValidParams && wordsOk ? wordsParam : undefined

  useEffect(() => {
    if (hasValidParams) return
    reportError(
      "Restore phrase route params missing",
      new Error("Route delivered no valid step/words combination"),
      { dedupKey: "restore-phrase-params-missing", alwaysRecord: true },
    )
  }, [hasValidParams])

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
    allFilled,
    isValid,
    validationError,
    status,
    isStep1,
    handleContinue,
    handleRestore,
    focusRequest,
    clearFocusRequest,
  } = useRestorePhrase({ step, initialWords })

  const showInvalidMnemonic = !isStep1 && allFilled && !isValid
  const showError = Boolean(validationError) || showInvalidMnemonic

  const inputRefs = useRef<Array<MnemonicWordInputHandle | null>>([])

  useEffect(() => {
    if (focusRequest === null) return
    const localIndex = focusRequest - offset
    inputRefs.current[localIndex]?.focus()
    clearFocusRequest()
  }, [focusRequest, clearFocusRequest, offset])

  const pasteLabel = LL.RestoreScreen.paste()

  // Step 1 -> step 2 updates params on this same mounted screen, so the Paste
  // button installed during step 1 has to be cleared explicitly here.
  useLayoutEffect(() => {
    if (!isStep1) {
      navigation.setOptions(noHeaderRight)
      return
    }
    navigation.setOptions(
      headerRightNoGlass(() => (
        <GaloyTertiaryButton
          clear
          title={pasteLabel}
          onPress={handlePasteFromClipboard}
          containerStyle={styles.headerButton}
          hitSlop={HEADER_BUTTON_HIT_SLOP}
          {...testProps("restore-paste-button")}
          accessibilityLabel={pasteLabel}
        />
      )),
    )
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

      {isStep1 && (
        <View style={styles.warningCard}>
          <WarningCard title={LL.RestoreScreen.recognizePhraseTitle()}>
            {LL.RestoreScreen.recognizePhraseBody()}
          </WarningCard>
        </View>
      )}

      <View style={styles.inputList}>
        {stepWords.map((word, i) => {
          const globalIndex = offset + i
          return (
            <MnemonicWordInput
              key={globalIndex}
              ref={(handle) => {
                inputRefs.current[i] = handle
              }}
              index={globalIndex}
              value={word}
              placeholder={`${LL.RestoreScreen.enterWord()} ${globalIndex + 1}`}
              onChangeText={(text) => {
                if (globalIndex === 0 && handlePaste(text)) return
                updateWord(globalIndex, text)
              }}
              onFocus={() => setActiveIndex(globalIndex)}
              correct={!isStep1 && isValid}
              wrong={showError}
              testID={`restore-word-${globalIndex}`}
            />
          )
        })}
      </View>

      <View style={styles.errorContainer}>
        {showError && (
          <>
            <GaloyIcon name="warning" size={14} color={colors.error} />
            <Text style={styles.errorText} {...testProps("restore-error")}>
              {validationError ?? LL.RestoreScreen.invalidMnemonic()}
            </Text>
          </>
        )}
      </View>
    </OnboardingScreenLayout>
  )
}

export const RestorePhraseScreen: React.FC = () => (
  // Input-only screen: the user types a phrase they already hold. Failing closed
  // here would lock a reinstalling user out of their funds on a device where
  // registration never succeeds, so the gate degrades to mounting the content
  // unprotected after its retries are exhausted.
  <ScreenSecurityGate failOpen>
    <RestorePhraseContent />
  </ScreenSecurityGate>
)

const useStyles = makeStyles(({ colors }) => ({
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
    marginBottom: 20,
  },
  warningCard: {
    marginBottom: 20,
  },
  inputList: {
    gap: 10,
  },
  headerButton: {
    marginRight: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 20,
    marginTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
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
