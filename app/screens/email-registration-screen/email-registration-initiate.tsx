import * as React from "react"
import { Alert, View } from "react-native"
import validator from "validator"

import { gql } from "@apollo/client"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Input, Text, makeStyles } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { Screen } from "@app/components/screen"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useUserEmailRegistrationInitiateMutation } from "@app/graphql/generated"

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  secondaryButtonContainer: {
    marginTop: 15,
    marginBottom: -15,
  },
  inputContainer: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 48,
  },
  textContainer: {
    marginBottom: 25,
  },
  viewWrapper: { flex: 1 },

  inputContainerStyle: {
    flex: 1,
    borderWidth: 2,
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    borderColor: colors.primary5,
    borderRadius: 8,
  },
  errorContainer: {
    marginBottom: 20,
  },
}))

gql`
  mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {
    userEmailRegistrationInitiate(input: $input) {
      errors {
        message
      }
      emailRegistrationId
      me {
        id
        email {
          address
          verified
        }
      }
    }
  }
`

type EmailRegistrationInitiateScreenProps = {
  route: RouteProp<RootStackParamList, "emailRegistrationInitiate">
}

export const EmailRegistrationInitiateScreen: React.FC<
  EmailRegistrationInitiateScreenProps
> = ({ route }) => {
  const styles = useStyles()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "emailRegistrationInitiate">>()

  const [emailInput, setEmailInput] = React.useState<string>("")
  const [errorMessage, setErrorMessage] = React.useState<string>("")
  const [loading, setLoading] = React.useState<boolean>(false)
  const { onboarding = false, hasUsername = false } = route.params ?? {}

  const { LL } = useI18nContext()
  const [setEmailMutation] = useUserEmailRegistrationInitiateMutation()

  const submit = async () => {
    if (!validator.isEmail(emailInput)) {
      setErrorMessage(LL.EmailRegistrationInitiateScreen.invalidEmail())
      return
    }

    setLoading(true)

    try {
      const { data } = await setEmailMutation({
        variables: { input: { email: emailInput } },
      })

      const errors = data?.userEmailRegistrationInitiate.errors
      if (errors && errors.length > 0) {
        console.log(errors, "errors")
        setErrorMessage(errors[0].message)
        return
      }

      const emailRegistrationId = data?.userEmailRegistrationInitiate.emailRegistrationId

      if (emailRegistrationId) {
        navigation.navigate("emailRegistrationValidate", {
          emailRegistrationId,
          email: emailInput,
          onboarding,
          hasUsername,
        })
      } else {
        setErrorMessage(LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId())
      }
    } catch (err) {
      if (err instanceof Error) {
        Alert.alert(LL.common.error(), err.message)
      }
      console.error(err, "error in setEmailMutation")
    } finally {
      setLoading(false)
    }
  }

  const onboardingNavigate = () => {
    if (hasUsername) {
      navigation.navigate("onboarding", {
        screen: "supportScreen",
      })
      return
    }

    navigation.navigate("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding },
    })
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
          <Text type={"h2"}>{LL.EmailRegistrationInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Input
            {...testProps(LL.EmailRegistrationInitiateScreen.placeholder())}
            placeholder={LL.EmailRegistrationInitiateScreen.placeholder()}
            autoCapitalize="none"
            inputContainerStyle={styles.inputContainerStyle}
            renderErrorMessage={false}
            textContentType="emailAddress"
            keyboardType="email-address"
            value={emailInput}
            onChangeText={setEmailInput}
            autoFocus={true}
          />
        </View>
        {errorMessage && (
          <View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage} />
          </View>
        )}

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.EmailRegistrationInitiateScreen.send()}
            loading={loading}
            disabled={!validator.isEmail(emailInput)}
            onPress={submit}
          />
          {onboarding && (
            <GaloySecondaryButton
              title={LL.UpgradeAccountModal.notNow()}
              onPress={onboardingNavigate}
              containerStyle={styles.secondaryButtonContainer}
            />
          )}
        </View>
      </View>
    </Screen>
  )
}
