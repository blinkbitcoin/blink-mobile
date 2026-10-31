import React, { useEffect, useRef, useState } from "react"
import {
  Keyboard,
  Pressable,
  View,
  TextInput,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"

export type NoteInputProps = {
  onBlur?: (() => void) | undefined
  onChangeText?: ((text: string) => void) | undefined
  value?: string | undefined
  editable?: boolean | undefined
  style?: StyleProp<ViewStyle>
  big?: boolean
  iconSize?: number
  fontSize?: number
  /** Replaces "Add note" as both the placeholder and the field's accessibility label. */
  placeholder?: string
  maxLength?: number
}

export const NoteInput: React.FC<NoteInputProps> = ({
  onChangeText,
  value,
  editable,
  onBlur,
  style,
  big = true,
  iconSize = 18,
  fontSize = 16,
  placeholder,
  maxLength = 500,
}) => {
  const { LL } = useI18nContext()
  const label = placeholder ?? LL.NoteInput.addNote()
  const [isFocused, setIsFocused] = useState(false)
  const styles = useStyles({ editable: Boolean(editable), big, isFocused })
  const {
    theme: { colors },
  } = useTheme()
  const textInputRef = useRef<TextInput>(null)

  /** Android's back gesture closes the keyboard but keeps the field focused; let go of it
   *  too, so the field never looks focused with no keyboard to type on. */
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () =>
      textInputRef.current?.blur(),
    )
    return () => sub.remove()
  }, [])

  const focusTextInput = () => {
    if (textInputRef.current) {
      textInputRef.current.focus()
    }
  }
  return (
    // The whole field focuses the input, since the input itself is only one line tall. Not
    // an element of its own for a screen reader, which reaches the input directly.
    <Pressable
      style={[styles.fieldBackground, style]}
      onPress={focusTextInput}
      accessible={false}
    >
      <View style={styles.noteContainer}>
        <TextInput
          {...testProps("add-note")}
          accessibilityLabel={label}
          style={[styles.noteInput, { fontSize }]}
          placeholder={label}
          placeholderTextColor={colors.black}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            onBlur?.()
          }}
          value={value}
          editable={editable}
          selectTextOnFocus
          maxLength={maxLength}
          ref={textInputRef}
        />
        {/* The same target as the field, so a screen reader skips it. */}
        <TouchableOpacity
          style={styles.noteIconContainer}
          onPress={focusTextInput}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <GaloyIcon name={"pencil"} size={iconSize} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(
  (
    { colors },
    { editable, big, isFocused }: { editable: boolean; big: boolean; isFocused: boolean },
  ) => ({
    fieldBackground: {
      flexDirection: "row",
      borderStyle: "solid",
      overflow: "hidden",
      /** Lifts to grey6 while typed in, as the conversion fields do. */
      backgroundColor: isFocused ? colors.grey6 : colors.grey5,
      paddingHorizontal: 10,
      borderRadius: 10,
      alignItems: "center",
      minHeight: big ? 60 : 50,
      opacity: editable ? 1 : 0.5,
    },
    fieldContainer: {
      marginBottom: 12,
    },
    noteContainer: {
      flex: 1,
      flexDirection: "row",
    },
    noteIconContainer: {
      justifyContent: "center",
      alignItems: "flex-start",
      paddingLeft: 20,
    },
    noteIcon: {
      justifyContent: "center",
      alignItems: "center",
    },
    noteInput: {
      flex: 1,
      color: colors.black,
      fontWeight: "400",
      lineHeight: 20,
      /** No platform padding, so the field's min height and font scale set its size. */
      paddingVertical: 0,
    },
  }),
)
