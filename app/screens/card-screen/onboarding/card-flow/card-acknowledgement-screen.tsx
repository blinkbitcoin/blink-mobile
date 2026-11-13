import * as React from "react"
import { View } from "react-native"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
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
import { toastShow } from "@app/utils/toast"

import { useCardApplicationSubmit } from "./use-card-application-submit"

export const CardAcknowledgementScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { params: answers } =
    useRoute<RouteProp<RootStackParamList, "cardOnboardingAcknowledgementScreen">>()
  const { submitApplication, isSubmitting } = useCardApplicationSubmit()

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

  const isAcceptingRef = React.useRef(false)

  /** The application is sent, so the onboarding steps leave the stack: going back from
   *  the wait lands on Home rather than on a step that would send it again. */
  const sendApplication = async () => {
    const applicationId = await submitApplication(answers)
    if (!applicationId) {
      toastShow({ message: LL.errors.unexpectedError(), LL })
      return
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: "Primary" }, { name: "cardOnboardingProcessingScreen" }],
      }),
    )
  }

  /** A second tap in the same frame lands before the spinner shows. Sent again, the
   *  application would be refused as a duplicate and read as a failure. */
  const handleAccept = () => {
    if (isAcceptingRef.current) return
    isAcceptingRef.current = true
    sendApplication().finally(() => {
      isAcceptingRef.current = false
    })
  }

  const { Acknowledgement: acknowledgementLL } = LL.CardFlow.Onboarding

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={acknowledgementLL.acceptButton()}
          onPress={handleAccept}
          disabled={isAcceptDisabled}
          loading={isSubmitting}
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
