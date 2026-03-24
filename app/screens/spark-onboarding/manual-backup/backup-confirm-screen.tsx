import React, { useState } from "react"
import { FlatList, Pressable, TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { getBip39Suggestions } from "@app/utils/bip39-wordlist"

type ConfirmRouteProp = RouteProp<RootStackParamList, "sparkBackupConfirmScreen">

export const SparkBackupConfirmScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<ConfirmRouteProp>()
  const { challenges } = route.params

  const [inputs, setInputs] = useState<string[]>(() => challenges.map(() => ""))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const updateInput = (index: number, value: string) =>
    setInputs((prev) => prev.map((current, idx) => (idx === index ? value : current)))

  const selectSuggestion = (index: number, word: string) => {
    updateInput(index, word)
    setActiveIndex(null)
  }

  const allCorrect = challenges.every(
    (challenge, i) => inputs[i].trim().toLowerCase() === challenge.word.toLowerCase(),
  )

  const allFilled = inputs.every((input) => input.trim().length > 0)

  const isWordCorrect = (index: number): boolean =>
    inputs[index].trim().toLowerCase() === challenges[index].word.toLowerCase()

  const activeSuggestions =
    activeIndex === null ? [] : getBip39Suggestions(inputs[activeIndex])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {LL.SparkOnboarding.ManualBackup.Confirm.subtitle()}
          </Text>

          <View style={styles.inputList}>
            {challenges.map((challenge, i) => {
              const correct = inputs[i].trim().length > 0 && isWordCorrect(i)
              return (
                <View key={challenge.index}>
                  <View style={[styles.inputContainer, correct && styles.inputCorrect]}>
                    <TextInput
                      style={styles.input}
                      placeholder={`${LL.SparkOnboarding.ManualBackup.Confirm.enterWord()} ${challenge.index + 1}`}
                      placeholderTextColor={colors.grey2}
                      value={inputs[i]}
                      onChangeText={(text) => {
                        updateInput(i, text)
                        setActiveIndex(i)
                      }}
                      onFocus={() => setActiveIndex(i)}
                      onBlur={() => setActiveIndex(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <GaloyIcon
                      name="pencil"
                      size={16}
                      color={correct ? colors._green : colors.primary}
                    />
                  </View>
                  {activeIndex === i && activeSuggestions.length > 0 && (
                    <FlatList
                      style={styles.suggestionsContainer}
                      data={activeSuggestions}
                      keyExtractor={(item) => item}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.suggestionItem}
                          onPress={() => selectSuggestion(i, item)}
                        >
                          <Text style={styles.suggestionText}>{item}</Text>
                        </Pressable>
                      )}
                    />
                  )}
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={
              allFilled
                ? LL.SparkOnboarding.ManualBackup.Confirm.confirm()
                : LL.SparkOnboarding.ManualBackup.Confirm.enterWords()
            }
            disabled={!allCorrect}
            onPress={() => navigation.navigate("sparkBackupSuccessScreen")}
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
    paddingVertical: 5,
    gap: 12,
  },
  inputCorrect: {
    borderColor: colors._green,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    fontFamily: "Source Sans Pro",
  },
  suggestionsContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 160,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
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
