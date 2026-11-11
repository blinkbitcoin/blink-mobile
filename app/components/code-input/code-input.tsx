import * as React from "react"
import { useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { testProps } from "@app/utils/testProps"
import { useTheme } from "@react-navigation/native"
import { Input, Text, makeStyles } from "@rn-vui/themed"

import { Screen } from "../screen"

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  viewWrapper: { flex: 1 },

  activityIndicator: { marginTop: 12 },
  textContainer: {
    marginBottom: 20,
  },

  inputComponentContainerStyle: {
    flexDirection: "row",
    marginBottom: 20,
    paddingLeft: 0,
    paddingRight: 0,
    justifyContent: "center",
  },
  inputContainerStyle: {
    minWidth: 160,
    minHeight: 60,
    borderWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceInteractive,
    borderRadius: 8,
    marginRight: 0,
  },
  fieldFocused: {
    backgroundColor: colors.surfaceFocused,
  },
  inputStyle: {
    fontSize: 24,
    textAlign: "center",
  },
  errorContainer: {
    marginBottom: 20,
  },
}))

type Props = {
  send: (code: string) => void
  header: string
  loading: boolean
  errorMessage: string | undefined
  setErrorMessage: (arg0: string) => void
}

const placeholder = "000000"

export const CodeInput: React.FC<Props> = ({
  send,
  header,
  loading,
  errorMessage,
  setErrorMessage,
}) => {
  const styles = useStyles()
  const { colors } = useTheme()

  const [code, _setCode] = useState("")
  // The field autofocuses on mount, so start focused: no resting fill flashes first.
  const [isFieldFocused, setIsFieldFocused] = useState(true)

  /** Nothing typed while a code is checked: the field keeps the one sent, rather than
   *  show another that would not be. */
  const setCode = (codeInput: string) => {
    if (loading) return
    const code = codeInput.trim()

    if (code.length > 6) {
      return
    }

    setErrorMessage("")
    _setCode(code)
    if (code.length === 6) {
      send(code)
    }
  }

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type="h2">{header}</Text>
        </View>

        <Input
          {...testProps("code-input")}
          placeholder={placeholder}
          containerStyle={styles.inputComponentContainerStyle}
          inputContainerStyle={[
            styles.inputContainerStyle,
            isFieldFocused && styles.fieldFocused,
          ]}
          onFocus={() => setIsFieldFocused(true)}
          onBlur={() => setIsFieldFocused(false)}
          inputStyle={styles.inputStyle}
          value={code}
          onChangeText={setCode}
          renderErrorMessage={false}
          autoFocus={true}
          textContentType={"oneTimeCode"}
          keyboardType="numeric"
        />
        {errorMessage && (
          <View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage} />
          </View>
        )}
        {loading && (
          <ActivityIndicator
            style={styles.activityIndicator}
            size="large"
            // React Navigation's theme, not the app palette: `primary` is its own key
            // eslint-disable-next-line no-restricted-syntax
            color={colors.primary}
          />
        )}
      </View>
    </Screen>
  )
}
