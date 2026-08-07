import React, { forwardRef, useImperativeHandle, useRef } from "react"
import { TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"

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

export type MnemonicWordInputHandle = {
  focus: () => void
}

export const MnemonicWordInput = forwardRef<
  MnemonicWordInputHandle,
  MnemonicWordInputProps
>(({ index, value, placeholder, onChangeText, onFocus, correct, wrong, testID }, ref) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const inputRef = useRef<TextInput | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  return (
    <View style={[styles.container, correct && styles.correct, wrong && styles.error]}>
      {/* Always mounted, fixed width: the row's layout must not depend on the input's
       *  content, or the first keystroke reflows the field under the user's finger. */}
      <Text
        style={[styles.wordNumber, value.trim().length === 0 && styles.wordNumberHidden]}
      >
        {index + 1}.
      </Text>
      <TextInput
        ref={inputRef}
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
})

MnemonicWordInput.displayName = "MnemonicWordInput"

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
  /** The number and the input share one typeface and no lineHeight override, so both
   *  center on the same baseline; lineHeight on an iOS TextInput anchors glyphs
   *  differently than on a Text and the two drift apart. */
  wordNumber: {
    width: 24,
    fontSize: 14,
    color: colors.grey2,
  },
  wordNumberHidden: {
    opacity: 0,
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
    fontFamily: "SourceSansPro-Regular",
    color: colors.black,
  },
}))
