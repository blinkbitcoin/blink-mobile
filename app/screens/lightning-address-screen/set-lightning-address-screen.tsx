import React, { useState, useCallback } from "react"
import { View, TextInput, Keyboard, Modal } from "react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"

import { radius } from "@app/rne-theme/radius"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { Screen } from "@app/components/screen"
import {
  validateUsername,
  SetUsernameError,
} from "@app/components/set-lightning-address-modal"
import { SuccessScreen } from "@app/components/success-screen"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig } from "@app/hooks"
import {
  useUserUpdateUsernameMutation,
  MyUserIdDocument,
  MyUserIdQuery,
} from "@app/graphql/generated"

gql`
  mutation userUpdateUsername($input: UserUpdateUsernameInput!) {
    userUpdateUsername(input: $input) {
      errors {
        code
      }
      user {
        id
        username
      }
    }
  }
`

gql`
  query myUserId {
    me {
      id
    }
  }
`

export const SetLightningAddressScreen: React.FC<{
  route: RouteProp<RootStackParamList, "setLightningAddress">
}> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [error, setError] = useState<SetUsernameError | undefined>()
  const [username, setUsername] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [isFieldFocused, setIsFieldFocused] = useState(false)
  const { onboarding } = route.params

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname, name: bankName },
    },
  } = useAppConfig()

  const [updateUsername, { loading }] = useUserUpdateUsernameMutation({
    update: (cache, { data }) => {
      if (data?.userUpdateUsername?.user) {
        const userIdQuery = cache.readQuery({
          query: MyUserIdDocument,
        }) as MyUserIdQuery

        const userId = userIdQuery.me?.id

        if (userId) {
          cache.modify({
            id: cache.identify({
              id: userId,
              __typename: "User",
            }),
            fields: {
              username: () => {
                return username
              },
            },
          })
        }
      }
    },
  })

  const onChangeUsername = (username: string) => {
    setUsername(username)
    setError(undefined)
  }

  const navigateSupportAllowBack = useCallback(() => {
    navigation.navigate("onboarding", {
      screen: "supportScreen",
    })
  }, [navigation])

  const navigateSupportNoBackAllow = useCallback(() => {
    navigation.replace("onboarding", {
      screen: "supportScreen",
      params: { canGoBack: false },
    })
  }, [navigation])

  const onSetLightningAddress = async () => {
    const validationResult = validateUsername(username)
    if (!validationResult.valid) {
      setError(validationResult.error)
      return
    }

    const { data } = await updateUsername({
      variables: { input: { username } },
    })

    if ((data?.userUpdateUsername?.errors ?? []).length > 0) {
      if (data?.userUpdateUsername?.errors[0]?.code === "USERNAME_ERROR") {
        setError(SetUsernameError.ADDRESS_UNAVAILABLE)
        return
      }

      setError(SetUsernameError.UNKNOWN_ERROR)
      return
    }

    Keyboard.dismiss()
    setShowSuccess(true)
  }

  const leaveAfterSuccess = useCallback(() => {
    if (onboarding) {
      navigateSupportNoBackAllow()
      return
    }
    navigation.navigate("settings")
  }, [onboarding, navigation, navigateSupportNoBackAllow])

  let errorMessage = ""
  switch (error) {
    case SetUsernameError.TOO_SHORT:
      errorMessage = LL.SetAddressModal.Errors.tooShort()
      break
    case SetUsernameError.TOO_LONG:
      errorMessage = LL.SetAddressModal.Errors.tooLong()
      break
    case SetUsernameError.INVALID_CHARACTER:
      errorMessage = LL.SetAddressModal.Errors.invalidCharacter()
      break
    case SetUsernameError.ADDRESS_UNAVAILABLE:
      errorMessage = LL.SetAddressModal.Errors.addressUnavailable()
      break
    case SetUsernameError.SERVER_UNREACHABLE:
      errorMessage = LL.SetAddressModal.Errors.serverUnreachable()
      break
    case SetUsernameError.UNKNOWN_ERROR:
      errorMessage = LL.SetAddressModal.Errors.unknownError()
      break
  }

  return (
    <Screen>
      <Modal
        visible={showSuccess}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowSuccess(false)}
      >
        <SuccessScreen
          title={LL.SetAddressModal.addressSet()}
          subtitle={`${username}@${lnAddressHostname}`}
          onHoldEnd={leaveAfterSuccess}
        />
      </Modal>

      <View style={styles.content}>
        <Text type={"h2"}>{LL.SetAddressModal.receiveMoney({ bankName })}</Text>
        <Text type={"h2"} color={colors.warning} bold>
          {LL.SetAddressModal.itCannotBeChanged()}
        </Text>

        <View
          style={[styles.textInputContainerStyle, isFieldFocused && styles.fieldFocused]}
        >
          <TextInput
            autoCorrect={false}
            autoComplete="off"
            style={styles.textInputStyle}
            onChangeText={onChangeUsername}
            onFocus={() => setIsFieldFocused(true)}
            onBlur={() => setIsFieldFocused(false)}
            value={username}
            placeholder={"SatoshiNakamoto"}
            placeholderTextColor={colors.textDisabled}
          />
          <Text type={"p1"}>{`@${lnAddressHostname}`}</Text>
        </View>

        {errorMessage && <GaloyErrorBox errorMessage={errorMessage} />}
      </View>

      <View style={styles.bottom}>
        <GaloyPrimaryButton
          title={LL.SetAddressModal.setLightningAddress()}
          loading={loading}
          disabled={!username}
          onPress={onSetLightningAddress}
        />
        {onboarding && (
          <GaloySecondaryButton
            title={LL.common.notNow()}
            onPress={navigateSupportAllowBack}
            containerStyle={styles.secondaryButtonContainer}
          />
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    rowGap: 20,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  secondaryButtonContainer: {
    marginTop: 15,
    marginBottom: -15,
  },
  textInputContainerStyle: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.default,
    minHeight: 60,
    backgroundColor: colors.surfaceInteractive,
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldFocused: {
    backgroundColor: colors.surfaceFocused,
  },
  textInputStyle: {
    flex: 1,
    fontSize: 18,
    color: colors.textOnBackground,
  },
}))
