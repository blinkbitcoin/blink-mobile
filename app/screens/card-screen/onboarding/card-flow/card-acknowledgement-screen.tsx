import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { CheckBox, makeStyles, Text, useTheme } from "@rn-vui/themed"
import InAppBrowser from "react-native-inappbrowser-reborn"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

type CheckboxRowProps = {
  checked: boolean
  onPress: () => void
  children: React.ReactNode
}

const CheckboxRow: React.FC<CheckboxRowProps> = ({ checked, onPress, children }) => {
  const styles = useStyles()

  return (
    <View style={styles.checkboxRow}>
      <CheckBox
        checked={checked}
        iconType="ionicon"
        checkedIcon={"checkbox"}
        uncheckedIcon={"square-outline"}
        onPress={onPress}
        containerStyle={styles.checkboxStyle}
      />
      <View style={styles.agreementTextContainer}>{children}</View>
    </View>
  )
}

export const CardAcknowledgementScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { cardESignConsentUrl, cardIssuerPrivacyPolicyUrl, cardCardholderAgreementUrl } =
    useRemoteConfig()

  const [isESignAccepted, setIsESignAccepted] = React.useState(false)
  const [isPrivacyAndTermsAccepted, setIsPrivacyAndTermsAccepted] = React.useState(false)
  const [isAccuracyCertified, setIsAccuracyCertified] = React.useState(false)
  const [isSolicitationAcknowledged, setIsSolicitationAcknowledged] =
    React.useState(false)

  const areAllTermsAccepted = [
    isESignAccepted,
    isPrivacyAndTermsAccepted,
    isAccuracyCertified,
    isSolicitationAcknowledged,
  ].every(Boolean)
  const isAcceptDisabled = !areAllTermsAccepted

  const handleAccept = () => {
    navigation.navigate("cardOnboardingProcessingScreen")
  }

  const { Acknowledgement: acknowledgementLL } = LL.CardFlow.Onboarding

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="document-outline"
          iconColor={colors.primary}
          title={acknowledgementLL.title()}
        />

        <View style={styles.checkboxesContainer}>
          <CheckboxRow
            checked={isESignAccepted}
            onPress={() => setIsESignAccepted(!isESignAccepted)}
          >
            <Text type="p3" style={styles.agreementText}>
              {acknowledgementLL.eSignConsent.text()}{" "}
              <Text
                style={styles.link}
                onPress={() => InAppBrowser.open(cardESignConsentUrl)}
              >
                {acknowledgementLL.eSignConsent.linkText()}
              </Text>
            </Text>
          </CheckboxRow>

          <CheckboxRow
            checked={isPrivacyAndTermsAccepted}
            onPress={() => setIsPrivacyAndTermsAccepted(!isPrivacyAndTermsAccepted)}
          >
            <Text type="p3" style={styles.agreementText}>
              {acknowledgementLL.privacyAndTerms.text()}{" "}
              <Text
                style={styles.link}
                onPress={() => InAppBrowser.open(cardIssuerPrivacyPolicyUrl)}
              >
                {acknowledgementLL.privacyAndTerms.privacyPolicyLinkText()}
              </Text>
              {acknowledgementLL.privacyAndTerms.and()}{" "}
              <Text
                style={styles.link}
                onPress={() => InAppBrowser.open(cardCardholderAgreementUrl)}
              >
                {acknowledgementLL.privacyAndTerms.cardTermsLinkText()}
              </Text>
            </Text>
          </CheckboxRow>

          <CheckboxRow
            checked={isAccuracyCertified}
            onPress={() => setIsAccuracyCertified(!isAccuracyCertified)}
          >
            <Text type="p3" style={styles.agreementText}>
              {acknowledgementLL.certifyAccuracy()}
            </Text>
          </CheckboxRow>

          <CheckboxRow
            checked={isSolicitationAcknowledged}
            onPress={() => setIsSolicitationAcknowledged(!isSolicitationAcknowledged)}
          >
            <Text type="p3" style={styles.agreementText}>
              {acknowledgementLL.acknowledgeSolicitation()}
            </Text>
          </CheckboxRow>
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={acknowledgementLL.acceptButton()}
          onPress={handleAccept}
          disabled={isAcceptDisabled}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  checkboxesContainer: {
    marginTop: 40,
    gap: 18,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkboxStyle: {
    padding: 0,
    margin: 0,
    marginRight: 15,
    marginLeft: 0,
  },
  agreementTextContainer: {
    flex: 1,
  },
  agreementText: {
    color: colors.black,
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    fontWeight: "700",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
