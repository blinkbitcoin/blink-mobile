import React, { useCallback } from "react"
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
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
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
  const { challenges } = useRoute<ConfirmRouteProp>().params

  const { wallets } = useActiveWallet()
  const { setBackupCompleted } = useBackupState()
  const hasFunds = wallets.some((w) => w.balance.amount > 0)

  const onComplete = useCallback(() => {
    setBackupCompleted("manual")
    if (hasFunds) {
      navigation.navigate("sparkMigrationTransferringFunds")
      return
    }
    navigation.navigate("sparkBackupSuccessScreen")
  }, [navigation, hasFunds, setBackupCompleted])

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
  } = useBackupConfirm({ challenges, onComplete })

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
            disabled={!allCorrect}
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
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
