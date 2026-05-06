import React from "react"
import { TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { testProps } from "@app/utils/testProps"

type MnemonicWordInputProps = {
  index: number
  value: string
  placeholder: string
  onChangeText: (text: string) => void
  onFocus: () => void
  correct?: boolean
  wrong?: boolean
  testID?: string
}

export const MnemonicWordInput: React.FC<MnemonicWordInputProps> = ({
  index,
  value,
  placeholder,
  onChangeText,
  onFocus,
  correct,
  wrong,
  testID,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={[styles.container, correct && styles.correct, wrong && styles.error]}>
      {value.trim().length > 0 && <Text style={styles.wordNumber}>{index + 1}.</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.grey2}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="visible-password"
        {...testProps(testID ?? `word-input-${index}`)}
      />
      <GaloyIcon name="pencil" size={16} color={colors.primary} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
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
  correct: {
    borderColor: colors._green,
  },
  error: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
}))
