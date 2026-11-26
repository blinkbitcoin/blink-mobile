import React, { forwardRef, useImperativeHandle, useRef } from "react"
import { TextInput, View } from "react-native"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { radius } from "@app/rne-theme/radius"
import { testProps } from "@app/utils/testProps"
import { fonts } from "@app/rne-theme/fonts"

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
      <View style={styles.word}>
        {/* Only once there's a word: an empty field shows its placeholder from the left
         *  edge, as the design does, and the word moves over on the first keystroke. */}
        {value.trim().length > 0 && <Text style={styles.wordNumber}>{index + 1}.</Text>}
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="visible-password"
          {...testProps(testID ?? `word-input-${index}`)}
        />
      </View>
      <GaloyIcon name="pencil" size={16} color={colors.accent} />
    </View>
  )
})

MnemonicWordInput.displayName = "MnemonicWordInput"

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInteractive,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.transparent,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 12,
  },
  /** The space in the design's "7. festival", drawn as a gap. */
  word: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  /** The number and the input share one typeface and no lineHeight override, so both
   *  center on the same baseline; lineHeight on an iOS TextInput anchors glyphs
   *  differently than on a Text and the two drift apart. */
  wordNumber: {
    fontSize: 14,
    color: colors.textMuted,
  },
  correct: {
    borderColor: colors.success,
  },
  error: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textOnBackground,
  },
}))
