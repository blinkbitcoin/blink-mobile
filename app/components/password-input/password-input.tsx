import React, { useState } from "react"
import { Pressable, TextInput, View } from "react-native"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"
import { groupTitleGap } from "@app/rne-theme/tokens"

import { radius } from "@app/rne-theme/radius"

type PasswordInputProps = {
  label: string
  value: string
  onChangeText: (text: string) => void
  onBlur?: () => void
  placeholder?: string
  error?: string
  disabled?: boolean
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  disabled = false,
}) => {
  const [secure, setSecure] = useState(true)
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
        />
        <Pressable onPress={() => setSecure((prev) => !prev)} style={styles.eyeButton}>
          <GaloyIcon
            name={secure ? "eye" : "eye-slash"}
            size={16}
            color={colors.accent}
          />
        </Pressable>
      </View>
      <View style={styles.errorRow}>
        {error ? (
          <>
            <GaloyIcon name="warning-circle" size={12} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {},
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: groupTitleGap,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInteractive,
    borderRadius: radius.default,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textOnBackground,
    paddingVertical: 5,
  },
  eyeButton: {
    padding: 8,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 16,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
}))
