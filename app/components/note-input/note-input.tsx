import React, { useRef } from "react"
import { View, TextInput, StyleProp, ViewStyle, TouchableOpacity } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, useTheme } from "@rneui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"

export type NoteInputProps = {
  onBlur?: (() => void) | undefined
  onChangeText?: ((text: string) => void) | undefined
  value?: string | undefined
  editable?: boolean | undefined
  style?: StyleProp<ViewStyle>
  big?: boolean
}

export const NoteInput: React.FC<NoteInputProps> = ({
  onChangeText,
  value,
  editable,
  onBlur,
  style,
  big = true,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles({ editable: Boolean(editable), big })
  const {
    theme: { colors },
  } = useTheme()
  const textInputRef = useRef<TextInput>(null)

  const focusTextInput = () => {
    if (textInputRef.current) {
      textInputRef.current.focus()
    }
  }
  return (
    <View style={[styles.fieldBackground, style]}>
      <View style={styles.noteContainer}>
        <TextInput
          {...testProps("add-note")}
          style={styles.noteInput}
          placeholder={LL.NoteInput.addNote()}
          placeholderTextColor={colors.black}
          onChangeText={onChangeText}
          onBlur={onBlur}
          value={value}
          editable={editable}
          selectTextOnFocus
          maxLength={500}
          ref={textInputRef}
        />
        <TouchableOpacity style={styles.noteIconContainer} onPress={focusTextInput}>
          <GaloyIcon name={"note"} size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const useStyles = makeStyles(
  ({ colors }, { editable, big }: { editable: boolean; big: boolean }) => ({
    fieldBackground: {
      flexDirection: "row",
      borderStyle: "solid",
      overflow: "hidden",
      backgroundColor: colors.grey5,
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
      fontSize: 16,
    },
  }),
)
