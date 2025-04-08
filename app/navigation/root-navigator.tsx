import * as React from "react"

import HomeIcon from "@app/assets/icons/home.svg"
import LearnIcon from "@app/assets/icons/learn.svg"
import MapIcon from "@app/assets/icons/map.svg"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { SupportChatScreen } from "@app/screens/support-chat-screen/support-chat"
import {
  ConversionConfirmationScreen,
  ConversionDetailsScreen,
  ConversionSuccessScreen,
} from "@app/screens/conversion-flow"
import {
  EmailLoginInitiateScreen,
  EmailLoginValidateScreen,
} from "@app/screens/email-login-screen"
import {
  EmailRegistrationInitiateScreen,
  EmailRegistrationValidateScreen,
} from "@app/screens/email-registration-screen"
import { FullOnboardingFlowScreen } from "@app/screens/full-onboarding-flow"
import { GaloyAddressScreen } from "@app/screens/galoy-address-screen"
import { CirclesDashboardScreen } from "@app/screens/people-screen/circles/circles-dashboard-screen"
import { AllContactsScreen } from "@app/screens/people-screen/contacts/all-contacts"
import { PeopleTabIcon } from "@app/screens/people-screen/tab-icon"
import {
  PhoneLoginInitiateScreen,
  PhoneLoginInitiateType,
  PhoneLoginValidationScreen,
} from "@app/screens/phone-auth-screen"
import { PhoneRegistrationInitiateScreen } from "@app/screens/phone-auth-screen/phone-registration-input"
import { PhoneRegistrationValidateScreen } from "@app/screens/phone-auth-screen/phone-registration-validation"
import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"
import RedeemBitcoinDetailScreen from "@app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen"
import RedeemBitcoinResultScreen from "@app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-result-screen"
import SendBitcoinCompletedScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-completed-screen"
import SendBitcoinConfirmationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen"
import SendBitcoinDestinationScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-destination-screen"
import SendBitcoinDetailsScreen from "@app/screens/send-bitcoin-screen/send-bitcoin-details-screen"
import { AccountScreen } from "@app/screens/settings-screen/account"
import { DefaultWalletScreen } from "@app/screens/settings-screen/default-wallet"
import { DisplayCurrencyScreen } from "@app/screens/settings-screen/display-currency-screen"
import { NotificationSettingsScreen } from "@app/screens/settings-screen/notifications-screen"
import { ThemeScreen } from "@app/screens/settings-screen/theme-screen"
import { TransactionLimitsScreen } from "@app/screens/settings-screen/transaction-limits-screen"
import {
  TotpLoginValidateScreen,
  TotpRegistrationInitiateScreen,
  TotpRegistrationValidateScreen,
} from "@app/screens/totp-screen"
import { WebViewScreen } from "@app/screens/webview/webview"
import { testProps } from "@app/utils/testProps"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { CardStyleInterpolators, createStackNavigator } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rneui/themed"

import {
  AuthenticationCheckScreen,
  AuthenticationScreen,
} from "../screens/authentication-screen"
import { PinScreen } from "../screens/authentication-screen/pin-screen"
import { DeveloperScreen } from "../screens/developer-screen"
import { EarnMapScreen } from "../screens/earns-map-screen"
import { EarnQuiz, EarnSection } from "../screens/earns-screen"
import { SectionCompleted } from "../screens/earns-screen/section-completed"
import { GetStartedScreen } from "../screens/get-started-screen"
import { HomeScreen } from "../screens/home-screen"
import { MapScreen } from "../screens/map-screen/map-screen"
import { ContactsDetailScreen, PeopleScreen } from "../screens/people-screen"
import { PriceHistoryScreen } from "../screens/price/price-history-screen"
import { ScanningQRCodeScreen } from "../screens/send-bitcoin-screen"
import { SettingsScreen } from "../screens/settings-screen"
import { LanguageScreen } from "../screens/settings-screen/language-screen"
import { SecurityScreen } from "../screens/settings-screen/security-screen"
import { TransactionDetailScreen } from "../screens/transaction-detail-screen"
import { TransactionHistoryScreen } from "../screens/transaction-history/transaction-history-screen"
import { NotificationHistoryScreen } from "@app/screens/notification-history-screen/notification-history-screen"
import {
  PeopleStackParamList,
  PhoneValidationStackParamList,
  PrimaryStackParamList,
  RootStackParamList,
} from "./stack-param-lists"
import { AcceptTermsAndConditionsScreen } from "@app/screens/accept-t-and-c"

const RootNavigator = createStackNavigator<RootStackParamList>()

export const RootStack = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()

  return (
    <RootNavigator.Navigator
      screenOptions={{
        gestureEnabled: true,
        headerBackTitle: LL.common.back(),
        headerBackTestID: LL.common.back(),
        headerStyle: styles.headerStyle,
        headerTitleStyle: styles.title,
        headerBackTitleStyle: styles.title,
        headerTintColor: colors.black,
      }}
      initialRouteName={isAuthed ? "authenticationCheck" : "getStarted"}
    >
      <RootNavigator.Screen
        name="getStarted"
        component={GetStartedScreen}
        options={{ headerShown: false, animationEnabled: false }}
      />
      <RootNavigator.Screen
        name="authenticationCheck"
        component={AuthenticationCheckScreen}
        options={{ headerShown: false, animationEnabled: false }}
      />
      <RootNavigator.Screen
        name="authentication"
        component={AuthenticationScreen}
        options={{ headerShown: false, animationEnabled: false }}
      />
      <RootNavigator.Screen
        name="pin"
        component={PinScreen}
        options={{ headerShown: false }}
      />
      <RootNavigator.Screen
        name="Primary"
        component={PrimaryNavigator}
        options={{
          headerShown: false,
          animationEnabled: false,
          title: LL.PrimaryScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="scanningQRCode"
        component={ScanningQRCodeScreen}
        options={{
          title: LL.ScanningQRCodeScreen.title(),
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <RootNavigator.Screen
        name="sendBitcoinDestination"
        component={SendBitcoinDestinationScreen}
        options={{ title: LL.SendBitcoinScreen.title() }}
      />
      <RootNavigator.Screen
        name="sendBitcoinDetails"
        component={SendBitcoinDetailsScreen}
        options={{ title: LL.SendBitcoinScreen.title() }}
      />
      <RootNavigator.Screen
        name="sendBitcoinConfirmation"
        component={SendBitcoinConfirmationScreen}
        options={{ title: LL.SendBitcoinScreen.title() }}
      />
      <RootNavigator.Screen
        name="sendBitcoinCompleted"
        component={SendBitcoinCompletedScreen}
        options={{ title: LL.SendBitcoinScreen.title(), headerShown: false }}
      />
      <RootNavigator.Screen
        name="receiveBitcoin"
        component={ReceiveScreen}
        options={{
          title: LL.ReceiveScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="redeemBitcoinDetail"
        component={RedeemBitcoinDetailScreen}
        options={{
          title: LL.RedeemBitcoinScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="redeemBitcoinResult"
        component={RedeemBitcoinResultScreen}
        options={{
          title: LL.RedeemBitcoinScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="conversionDetails"
        component={ConversionDetailsScreen}
        options={{
          title: LL.ConversionDetailsScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="conversionConfirmation"
        component={ConversionConfirmationScreen}
        options={{
          title: LL.ConversionConfirmationScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="conversionSuccess"
        component={ConversionSuccessScreen}
        options={{
          headerShown: false,
          title: LL.ConversionSuccessScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="earnsSection"
        component={EarnSection}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          headerStyle: { backgroundColor: colors._blue },
          headerTintColor: colors._white,
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 18,
          },
          headerBackTitleStyle: { color: colors._white },
        }}
      />
      <RootNavigator.Screen
        name="earnsQuiz"
        component={EarnQuiz}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <RootNavigator.Screen
        name="settings"
        component={SettingsScreen}
        options={() => ({
          title: LL.SettingsScreen.title(),
        })}
      />
      <RootNavigator.Screen
        name="addressScreen"
        component={GaloyAddressScreen}
        options={() => ({
          title: "",
        })}
      />
      <RootNavigator.Screen
        name="defaultWallet"
        component={DefaultWalletScreen}
        options={() => ({
          title: LL.DefaultWalletScreen.title(),
        })}
      />
      <RootNavigator.Screen
        name="theme"
        component={ThemeScreen}
        options={() => ({
          title: LL.ThemeScreen.title(),
        })}
      />
      <RootNavigator.Screen
        name="language"
        component={LanguageScreen}
        options={{ title: LL.common.languagePreference() }}
      />
      <RootNavigator.Screen
        name="currency"
        component={DisplayCurrencyScreen}
        options={{ title: LL.common.currency() }}
      />
      <RootNavigator.Screen
        name="security"
        component={SecurityScreen}
        options={{ title: LL.common.security() }}
      />
      <RootNavigator.Screen
        name="developerScreen"
        component={DeveloperScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <RootNavigator.Screen
        name="sectionCompleted"
        component={SectionCompleted}
        options={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <RootNavigator.Screen
        name="phoneFlow"
        component={PhoneLoginNavigator}
        options={{ headerShown: false }}
      />
      <RootNavigator.Screen
        name="phoneRegistrationInitiate"
        options={{
          title: LL.common.phoneNumber(),
        }}
        component={PhoneRegistrationInitiateScreen}
      />
      <RootNavigator.Screen
        name="phoneRegistrationValidate"
        component={PhoneRegistrationValidateScreen}
        options={{
          title: LL.common.codeConfirmation(),
        }}
      />
      <RootNavigator.Screen
        name="transactionDetail"
        component={TransactionDetailScreen}
        options={{
          headerShown: false,
          // cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS,
        }}
      />
      <RootNavigator.Screen
        name="transactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: LL.TransactionScreen.transactionHistoryTitle() }}
      />
      <RootNavigator.Screen
        name="priceHistory"
        component={PriceHistoryScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          title: LL.common.bitcoinPrice(),
        }}
      />
      <RootNavigator.Screen
        name="accountScreen"
        component={AccountScreen}
        options={{
          title: LL.common.account(),
        }}
      />
      <RootNavigator.Screen
        name="notificationSettingsScreen"
        component={NotificationSettingsScreen}
        options={{
          title: LL.NotificationSettingsScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="transactionLimitsScreen"
        component={TransactionLimitsScreen}
        options={{
          title: LL.common.transactionLimits(),
        }}
      />
      <RootNavigator.Screen
        name="acceptTermsAndConditions"
        component={AcceptTermsAndConditionsScreen}
        options={{
          title: LL.AcceptTermsAndConditionsScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="emailRegistrationInitiate"
        component={EmailRegistrationInitiateScreen}
        options={{
          title: LL.EmailRegistrationInitiateScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="emailRegistrationValidate"
        component={EmailRegistrationValidateScreen}
        options={{
          title: LL.common.codeConfirmation(),
        }}
      />
      <RootNavigator.Screen
        name="emailLoginInitiate"
        component={EmailLoginInitiateScreen}
        options={{
          title: LL.EmailLoginInitiateScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="emailLoginValidate"
        component={EmailLoginValidateScreen}
        options={{
          title: LL.common.codeConfirmation(),
        }}
      />
      <RootNavigator.Screen
        name="totpRegistrationInitiate"
        component={TotpRegistrationInitiateScreen}
        options={{
          title: LL.TotpRegistrationInitiateScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="totpRegistrationValidate"
        component={TotpRegistrationValidateScreen}
        options={{
          title: LL.TotpRegistrationValidateScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="totpLoginValidate"
        component={TotpLoginValidateScreen}
        options={{
          title: LL.TotpLoginValidateScreen.title(),
        }}
      />
      <RootNavigator.Screen
        name="webView"
        component={WebViewScreen}
        options={{
          title: "WebView", // should be overridden by the navigate action with an initial title
        }}
      />
      <RootNavigator.Screen
        name="fullOnboardingFlow"
        component={FullOnboardingFlowScreen}
        options={{
          title: LL.FullOnboarding.title(),
        }}
      />
      <RootNavigator.Screen
        name="supportChat"
        component={SupportChatScreen}
        options={{
          title: LL.support.chatbot(),
        }}
      />
      <RootNavigator.Screen
        name="notificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: LL.NotificationHistory.title() }}
      />
    </RootNavigator.Navigator>
  )
}

const StackContacts = createStackNavigator<PeopleStackParamList>()

export const ContactNavigator = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <StackContacts.Navigator
      screenOptions={{
        gestureEnabled: true,
        headerBackTitle: LL.common.back(),
        headerBackTestID: LL.common.back(),
        headerStyle: styles.headerStyle,
        headerTitleStyle: styles.title,
        headerBackTitleStyle: styles.title,
        headerTintColor: colors.black,
      }}
      initialRouteName="peopleHome"
    >
      <StackContacts.Screen
        name="peopleHome"
        component={PeopleScreen}
        options={{
          title: LL.PeopleScreen.title(),
          headerShown: false,
        }}
      />
      <StackContacts.Screen
        name="contactDetail"
        component={ContactsDetailScreen}
        options={{ headerShown: false }}
      />
      <StackContacts.Screen
        name="allContacts"
        component={AllContactsScreen}
        options={{
          title: LL.PeopleScreen.allContacts(),
        }}
      />
      <StackContacts.Screen
        name="circlesDashboard"
        component={CirclesDashboardScreen}
        options={{
          title: LL.Circles.title(),
        }}
      />
    </StackContacts.Navigator>
  )
}
const StackPhoneValidation = createStackNavigator<PhoneValidationStackParamList>()

export const PhoneLoginNavigator = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  function getTitle(type: PhoneLoginInitiateType) {
    return type === PhoneLoginInitiateType.CreateAccount
      ? LL.PhoneLoginInitiateScreen.title()
      : LL.common.phoneNumber()
  }

  return (
    <StackPhoneValidation.Navigator
      screenOptions={{
        gestureEnabled: true,
        headerBackTitle: LL.common.back(),
        headerBackTestID: LL.common.back(),
        headerStyle: styles.headerStyle,
        headerTitleStyle: styles.title,
        headerBackTitleStyle: styles.title,
        headerTintColor: colors.black,
      }}
    >
      <StackPhoneValidation.Screen
        name="phoneLoginInitiate"
        options={(props) => ({
          title: getTitle(props.route.params.type),
        })}
        component={PhoneLoginInitiateScreen}
      />
      <StackPhoneValidation.Screen
        name="phoneLoginValidate"
        component={PhoneLoginValidationScreen}
        options={(props) => ({
          title: getTitle(props.route.params.type),
        })}
      />
    </StackPhoneValidation.Navigator>
  )
}

const Tab = createBottomTabNavigator<PrimaryStackParamList>()

export const PrimaryNavigator = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  // The cacheId is updated after every mutation that affects current user data (balanace, contacts, ...)
  // It's used to re-mount this component and thus reset what's cached in Apollo (and React)

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.grey2,
        tabBarStyle: styles.bottomNavigatorStyle,
        tabBarLabelStyle: { paddingBottom: 6, fontSize: 12, fontWeight: "bold" },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: LL.HomeScreen.title(),
          tabBarAccessibilityLabel: LL.HomeScreen.title(),
          tabBarTestID: LL.HomeScreen.title(),
          tabBarIcon: ({ color }) => (
            <HomeIcon {...testProps("Home")} fill={color} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="People"
        component={ContactNavigator}
        options={{
          headerShown: false,
          title: LL.PeopleScreen.title(),
          tabBarAccessibilityLabel: LL.PeopleScreen.title(),
          tabBarTestID: LL.PeopleScreen.title(),
          tabBarIcon: ({ color, focused }) => (
            <PeopleTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: LL.MapScreen.title(),
          headerShown: false,
          tabBarAccessibilityLabel: LL.MapScreen.title(),
          tabBarTestID: LL.MapScreen.title(),
          tabBarIcon: ({ color }) => <MapIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Earn"
        component={EarnMapScreen}
        options={{
          title: LL.EarnScreen.title(),
          headerShown: false,
          tabBarAccessibilityLabel: LL.EarnScreen.title(),
          tabBarTestID: LL.EarnScreen.title(),
          tabBarIcon: ({ color }) => <LearnIcon {...testProps("Earn")} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bottomNavigatorStyle: {
    height: "10%",
    paddingTop: 4,
    backgroundColor: colors.white,
    borderTopColor: colors.grey4,
  },
  headerStyle: {
    backgroundColor: colors.white,
  },
  title: {
    color: colors.black,
  },
}))
