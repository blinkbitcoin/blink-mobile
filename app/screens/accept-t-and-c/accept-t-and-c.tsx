import * as React from "react"
import { Alert, View } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"

import { Screen } from "../../components/screen"
import { PhoneLoginInitiateType } from "../phone-auth-screen"
import useAppCheckToken from "../get-started-screen/use-device-token"
import { useCreateDeviceAccount } from "../get-started-screen/use-create-device-account"

export const AcceptTermsAndConditionsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "acceptTermsAndConditions">>()

  const route = useRoute<RouteProp<RootStackParamList, "acceptTermsAndConditions">>()
  const { flow } = route.params || { flow: "phone" }

  const { deviceAccountEnabled } = useFeatureFlags()
  const appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled })
  const { createDeviceAccountAndLogin, loading } = useCreateDeviceAccount()

  const fallbackToPhoneLogin = () => {
    navigation.navigate("login", {
      type: PhoneLoginInitiateType.CreateAccount,
    })
  }

  const action = async () => {
    if (flow === "phone" || !appCheckToken) {
      fallbackToPhoneLogin()
      return
    }

    if (flow === "trial") {
      createDeviceAccountAndLogin(appCheckToken).catch(fallbackToPhoneLogin)
      return
    }

    Alert.alert("unknown flow")
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
          <Text type={"p1"}>{LL.AcceptTermsAndConditionsScreen.text()}</Text>
        </View>

        <View style={styles.textContainer}>
          <GaloySecondaryButton
            title={LL.AcceptTermsAndConditionsScreen.termsAndConditions()}
            onPress={() => InAppBrowser.open("https://www.blink.sv/en/terms-conditions")}
          />
        </View>
        <View style={styles.textContainer}>
          <GaloySecondaryButton
            title={LL.AcceptTermsAndConditionsScreen.prohibitedCountry()}
            onPress={() =>
              InAppBrowser.open(
                "https://faq.blink.sv/creating-a-blink-account/which-countries-are-unable-to-download-and-activate-blink",
              )
            }
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AcceptTermsAndConditionsScreen.accept()}
            onPress={action}
            loading={loading}
            disabled={loading}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 14,
  },

  inputContainer: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 48,
  },
  textContainer: {
    marginBottom: 20,
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
