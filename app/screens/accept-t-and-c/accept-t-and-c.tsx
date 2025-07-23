import * as React from "react"
import { Alert, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles } from "@rn-vui/themed"

import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { Screen } from "../../components/screen"
import { PhoneLoginInitiateType } from "../phone-auth-screen"
import { DeviceAccountModal } from "../get-started-screen/device-account-modal"

export const AcceptTermsAndConditionsScreen: React.FC = () => {
  const styles = useStyles()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "acceptTermsAndConditions">>()

  const { LL } = useI18nContext()

  const route = useRoute<RouteProp<RootStackParamList, "acceptTermsAndConditions">>()
  const { flow } = route.params || { flow: "phone" }

  const [confirmationModalVisible, setConfirmationModalVisible] = React.useState(false)
  const openConfirmationModal = () => setConfirmationModalVisible(true)
  const closeConfirmationModal = () => {
    setConfirmationModalVisible(false)
  }

  const action = () => {
    if (flow === "phone") {
      navigation.navigate("phoneFlow", {
        screen: "phoneLoginInitiate",
        params: {
          type: PhoneLoginInitiateType.CreateAccount,
        },
      })
    } else if (flow === "trial") {
      openConfirmationModal()
    } else {
      Alert.alert("unknown flow")
    }
  }

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <DeviceAccountModal
        isVisible={confirmationModalVisible}
        closeModal={closeConfirmationModal}
      />
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
