import * as React from "react"
import debounce from "lodash.debounce"
import { gql, useMutation } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import { ActivityIndicator, Alert, Text, TextInput, Keyboard } from "react-native"
import { Button } from "react-native-elements"
import { Input } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"

import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { color, palette } from "../../theme"
import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  activity: { 
    marginTop: 2,
    marginBottom: 2,
  },

  /* eslint-disable react-native/no-unused-styles */
  availableMessage: { color: palette.green },
  errorMessage: { color: palette.red },

  screenStyle: {
    marginHorizontal: 48,
  },

  text: {
    fontSize: "16rem",
    paddingVertical: "18rem",
    textAlign: "center",
  },
  subtext: {
    fontSize: "14rem",
    paddingBottom: "18rem",
    textAlign: "center",
  }
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "setEmail">
}

const UPDATE_EMAIL = gql`
  mutation UpdateMyEmailAddress($input: UserUpdateEmailInput!) {
    userUpdateEmail(input: $input) {
      errors {
        message
      }
      user {
        id
        email
      }
    }
  }
`

export const EmailScreen: ScreenType = ({ navigation }: Props) => {
  const [input, setInput] = React.useState("")
  const [inputStatus, setInputStatus] = React.useState({
    status: "empty",
    message: "",
  })

  const { refetch: refetchMain } = useMainQuery()
  const inputForm = React.createRef<TextInput>()

  const [updateEmail, { loading: updatingEmail }] = useMutation(UPDATE_EMAIL, {
    onError: (error) => {
      console.error(error)
      setInputStatus({ message: translate("errors.generic"), status: "error" })
    },
    onCompleted: (data) => {
      const { errors, user } = data.userUpdateEmail

      const errorMessage =
        errors.length > 0 || !user
          ? errors[0]?.message || "issue setting up email"
          : null

      if (errorMessage) {
        setInputStatus({ message: errorMessage, status: "error" })
      }

      refetchMain()

      Alert.alert(translate("EmailScreen.success", { input }), null, [
        {
          text: translate("common.ok"),
          onPress: () => {
            navigation.pop(2)
          },
        },
      ])
    },
  })

  const validateAndConfirm = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(input)) {
      setInputStatus({
        message: translate("EmailScreen.invalidEmail"),
        status: "error",
      })
      inputForm.current.focus()
      return
    }

    Alert.alert(
      translate("EmailScreen.confirmTitle", { input }),
      translate("EmailScreen.confirmSubtext"),
      [
        {
          text: translate("common.cancel"),
          onPress: () => console.log("Cancel Pressed"),
          style: "cancel",
        },
        {
          text: translate("common.ok"),
          onPress: () =>
            updateEmail({
              variables: { 
                input: {
                  email: input
                } 
              },
            }),
        },
      ],
    )
  }

  const onChangeText = (value) => {
    setInputStatus({ message: "", status: "" })
    setInput(value.trim())
    if (!value) {
      setInputStatus({ message: "", status: "empty"})
    }
  }

  return (
    <Screen preset="scroll" style={styles.screenStyle}>
      <Text style={styles.text}>{translate("EmailScreen.emailToUse")}</Text>
      <Text style={styles.subtext}>{translate("EmailScreen.emailToUseSubtitle")}</Text>
      <Input
        ref={inputForm}
        autoFocus
        placeholder={translate("common.email")}
        leftIcon={{ type: "ionicon", name: "mail-outline" }}
        onChangeText={onChangeText}
        errorStyle={styles[`${inputStatus.status}Message`]}
        errorMessage={inputStatus.message}
        returnKeyType="send"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        value={input}
      />
      <ActivityIndicator
        animating={updatingEmail}
        size="large"
        color={color.primary}
        style={styles.activity}
      />
      <Button
        title={translate("EmailScreen.setEmail")}
        disabled={!input || updatingEmail}
        onPress={() => {
          validateAndConfirm()
        }}
      />
    </Screen>
  )
} 