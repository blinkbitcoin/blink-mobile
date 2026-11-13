import * as React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/card-screen/checkbox-row"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { openExternalUrl } from "@app/utils/external"

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
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={acknowledgementLL.acceptButton()}
          onPress={handleAccept}
          disabled={isAcceptDisabled}
        />
      }
    >
      <View style={styles.content}>
        <IconHero
          icon="document-outline"
          iconColor={colors.accent}
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
                onPress={() => openExternalUrl(cardESignConsentUrl)}
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
                onPress={() => openExternalUrl(cardIssuerPrivacyPolicyUrl)}
              >
                {acknowledgementLL.privacyAndTerms.privacyPolicyLinkText()}
              </Text>
              {acknowledgementLL.privacyAndTerms.and()}{" "}
              <Text
                style={styles.link}
                onPress={() => openExternalUrl(cardCardholderAgreementUrl)}
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
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  /** On top of the hero's own 20, so it sits 30 below the header like the other card steps. */
  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  /** The design's hero keeps an empty subtitle line and its bottom padding under the
   *  title, so the first box starts 66 below it. */
  checkboxesContainer: {
    marginTop: 66,
    gap: 20,
  },
  agreementText: {
    color: colors.textOnBackground,
    lineHeight: 16,
  },
  link: {
    color: colors.accent,
    fontWeight: "700",
  },
}))
