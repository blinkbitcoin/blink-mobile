import React, { useCallback, useEffect, useRef } from "react"
import { TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { SuggestionBar } from "@app/components/suggestion-bar"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { BackupStatus, useBackupState } from "@app/self-custodial/providers/backup-state"
import { logSelfCustodialBackupCompleted } from "@app/utils/analytics"
import { hasFunds } from "@app/utils/has-funds"
import { testProps } from "@app/utils/testProps"

import { useBackupConfirm } from "../hooks"

type ConfirmRouteProp = RouteProp<RootStackParamList, "sparkBackupConfirmScreen">

export const SparkBackupConfirmScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { challenges, successMessage } = useRoute<ConfirmRouteProp>().params

  const { wallets, isSelfCustodial } = useActiveWallet()
  const { backupState, setBackupCompleted } = useBackupState()
  const { checkpoint, loading: checkpointLoading } = useMigrationCheckpoint()
  const alreadyBackedUp = backupState.status === BackupStatus.Completed
  // Migration only applies on a custodial account; self-custodial backups are standalone.
  const isMigrating = !isSelfCustodial && checkpoint !== null && !alreadyBackedUp
  const walletsHaveFunds = hasFunds(wallets)

  const onComplete = useCallback(() => {
    setBackupCompleted("manual")
    logSelfCustodialBackupCompleted({ backupMethod: "manual" })
    if (isMigrating && walletsHaveFunds) {
      navigation.navigate("sparkMigrationTransferringFunds")
      return
    }
    navigation.navigate("sparkBackupSuccessScreen", {
      reBackup: alreadyBackedUp,
      message: successMessage,
    })
  }, [
    navigation,
    isMigrating,
    walletsHaveFunds,
    alreadyBackedUp,
    setBackupCompleted,
    successMessage,
  ])

  const {
    inputs,
    activeIndex,
    activeSuggestions,
    allCorrect,
    allFilled,
    updateInput,
    setActiveIndex,
    selectSuggestion,
    isWordCorrect,
    isWordWrong,
    focusRequest,
    clearFocusRequest,
  } = useBackupConfirm({ challenges, onComplete, disabled: checkpointLoading })

  const anyWrong = challenges.some((_, i) => isWordWrong(i))

  const inputRefs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    if (focusRequest === null) return
    inputRefs.current[focusRequest]?.focus()
    clearFocusRequest()
  }, [focusRequest, clearFocusRequest])

  return (
    <Screen preset="fixed" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {LL.BackupScreen.ManualBackup.Confirm.subtitle()}
          </Text>

          <View style={styles.inputList}>
            {challenges.map((challenge, i) => {
              const correct = inputs[i].trim().length > 0 && isWordCorrect(i)
              const wrong = isWordWrong(i)
              return (
                <View key={challenge.index}>
                  <View
                    style={[
                      styles.inputContainer,
                      correct && styles.inputCorrect,
                      wrong && styles.inputError,
                    ]}
                  >
                    {inputs[i].trim().length > 0 && (
                      <Text style={styles.wordNumber}>{challenge.index + 1}.</Text>
                    )}
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[i] = ref
                      }}
                      style={styles.input}
                      placeholder={`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} ${challenge.index + 1}`}
                      placeholderTextColor={colors.grey2}
                      value={inputs[i]}
                      onChangeText={(text) => {
                        updateInput(i, text)
                        setActiveIndex(i)
                      }}
                      onFocus={() => setActiveIndex(i)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="visible-password"
                      {...testProps(`confirm-word-${challenge.index}`)}
                    />
                    <GaloyIcon name="pencil" size={16} color={colors.primary} />
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.errorContainer}>
            {anyWrong && (
              <>
                <GaloyIcon name="warning" size={14} color={colors.error} />
                <Text style={styles.errorText}>
                  {LL.BackupScreen.ManualBackup.Confirm.incorrectWord()}
                </Text>
              </>
            )}
          </View>
        </View>

        {activeIndex !== undefined && (
          <SuggestionBar
            suggestions={activeSuggestions}
            onSelect={(word) => selectSuggestion(activeIndex, word)}
          />
        )}

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={
              allFilled
                ? LL.BackupScreen.ManualBackup.Confirm.confirm()
                : LL.BackupScreen.ManualBackup.Confirm.enterWords()
            }
            disabled={!allCorrect || checkpointLoading}
            onPress={onComplete}
            {...testProps("backup-confirm-button")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 23,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputList: {
    gap: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.transparent,
    minHeight: 50,
    paddingHorizontal: 14,
    gap: 12,
  },
  wordNumber: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
  inputCorrect: {
    borderColor: colors._green,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    fontFamily: "Source Sans Pro",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
