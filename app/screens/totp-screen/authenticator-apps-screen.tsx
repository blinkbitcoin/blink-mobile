import React, { useCallback } from "react"
import { Linking, Platform, TouchableOpacity, View } from "react-native"
import { SvgProps } from "react-native-svg"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import GoogleAuthenticatorIcon from "@app/assets/icons/authenticator-apps/google-authenticator.svg"
import ProtonAuthenticatorIcon from "@app/assets/icons/authenticator-apps/proton-authenticator.svg"
import TwoFasAuthIcon from "@app/assets/icons/authenticator-apps/twofas-auth.svg"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AuthenticatorApp } from "@app/types/two-factor-enforcement"
import {
  logAuthenticatorAppSelected,
  logAuthenticatorEducationCompleted,
} from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

type AuthenticatorAppListing = {
  app: AuthenticatorApp
  /** A brand name, the same in every language. */
  name: string
  Icon: React.FC<SvgProps>
  description: (LL: TranslationFunctions) => string
  appStoreUrl: string
  playStoreUrl: string
}

/** Free, trusted apps, in the order the onboarding recommends them. */
const AUTHENTICATOR_APPS: ReadonlyArray<AuthenticatorAppListing> = [
  {
    app: AuthenticatorApp.GoogleAuthenticator,
    name: "Google Authenticator",
    Icon: GoogleAuthenticatorIcon,
    description: (LL) => LL.AuthenticatorOnboarding.googleAuthenticatorDescription(),
    appStoreUrl: "https://apps.apple.com/app/id388497605",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
  },
  {
    app: AuthenticatorApp.ProtonAuthenticator,
    name: "Proton Authenticator",
    Icon: ProtonAuthenticatorIcon,
    description: (LL) => LL.AuthenticatorOnboarding.protonAuthenticatorDescription(),
    appStoreUrl: "https://apps.apple.com/app/id6741758667",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=proton.android.authenticator",
  },
  {
    app: AuthenticatorApp.TwoFasAuth,
    name: "2FAS Auth",
    Icon: TwoFasAuthIcon,
    description: (LL) => LL.AuthenticatorOnboarding.twoFasAuthDescription(),
    appStoreUrl: "https://apps.apple.com/app/id1217793794",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.twofasapp",
  },
]

/** Read at the tap rather than once, so the store follows the platform it runs on. */
const storeUrlOf = (listing: AuthenticatorAppListing): string =>
  Platform.OS === "ios" ? listing.appStoreUrl : listing.playStoreUrl

/**
 * The onboarding's second screen: three apps to get, each opening its store listing,
 * for a user without one. Coming back from the store lands here again, and I have an
 * app moves on to the setup key with an app at hand.
 */
export const AuthenticatorAppsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "totpRegistrationApps">>()

  const handleGet = useCallback((listing: AuthenticatorAppListing) => {
    logAuthenticatorAppSelected({ app: listing.app })
    Linking.openURL(storeUrlOf(listing)).catch((err) =>
      reportError("Authenticator app store link", err, { expected: true }),
    )
  }, [])

  const handleHaveAnApp = useCallback(() => {
    logAuthenticatorEducationCompleted()
    navigation.navigate("totpRegistrationInitiate")
  }, [navigation])

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AuthenticatorOnboarding.haveAnApp()}
          onPress={handleHaveAnApp}
          {...testProps("authenticator-apps-have-an-app")}
        />
      }
    >
      <IconHero
        icon="apps"
        iconColor={colors._green}
        title={LL.AuthenticatorOnboarding.appsTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.AuthenticatorOnboarding.appsDescription()}
          </Text>
        }
      />
      <View style={styles.list}>
        {AUTHENTICATOR_APPS.map((listing) => (
          <TouchableOpacity
            key={listing.app}
            style={styles.appRow}
            onPress={() => handleGet(listing)}
            activeOpacity={0.7}
            accessibilityRole="button"
            {...testProps(`authenticator-app-${listing.app}`)}
          >
            <View style={styles.appIcon}>
              <listing.Icon />
            </View>
            <View style={styles.appText}>
              <Text style={styles.appName}>{listing.name}</Text>
              <Text style={styles.appDescription}>{listing.description(LL)}</Text>
            </View>
            <View style={styles.getBadge}>
              <Text style={styles.getLabel}>{LL.AuthenticatorOnboarding.get()}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Text type="p4" style={styles.storeNote}>
          {LL.AuthenticatorOnboarding.storeNote()}
        </Text>
      </View>
    </StepLayout>
  )
}

const APP_ICON_SIZE = 28

const useStyles = makeStyles(({ colors }) => ({
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
  list: {
    marginTop: 30,
    marginHorizontal: 20,
    gap: 10,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 8,
    backgroundColor: colors.grey5,
  },
  appIcon: {
    width: APP_ICON_SIZE,
    height: APP_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 0.21,
    borderColor: colors.grey3,
    backgroundColor: colors._white,
  },
  appText: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  appDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
  getBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.grey4,
  },
  getLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  storeNote: {
    color: colors.grey2,
  },
}))
