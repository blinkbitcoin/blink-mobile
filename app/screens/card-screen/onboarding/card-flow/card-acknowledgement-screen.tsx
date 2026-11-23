import * as React from "react"
import { View } from "react-native"
import {
  CommonActions,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { openExternalUrl } from "@app/utils/external"
import { toastShow } from "@app/utils/toast"

import { useCardApplicationSubmit } from "./use-card-application-submit"

/** The design's checkbox row: 14 between the box and its text, set at 14/16. */
const CHECKBOX_GAP = 14
const CHECKBOX_LINE_HEIGHT = 16

/** One press of Accept, set aside when the user leaves the step before it answers. */
type SendAttempt = { isAbandoned: boolean }

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
  /** The press still waiting for its answer, if any. */
  const pendingSendRef = React.useRef<SendAttempt | null>(null)

  /** Leaving the step, by closing it or going back, sets the pending send aside: its late
   *  answer must not reset the stack or show a toast over wherever the user went. The
   *  application still goes out, and the bulletin tells the user how it ends. */
  useFocusEffect(
    React.useCallback(
      () => () => {
        const pendingSend = pendingSendRef.current
        if (pendingSend) pendingSend.isAbandoned = true
      },
      [],
    ),
  )

  /** The application is sent, so the onboarding steps leave the stack: going back from
   *  the wait lands on Home rather than on a step that would send it again. */
  const sendApplication = async (attempt: SendAttempt) => {
    const applicationId = await submitApplication(answers)
    if (attempt.isAbandoned) return
    if (!applicationId) {
      toastShow({ message: LL.errors.unexpectedError(), LL })
      return
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Primary" },
          { name: "cardOnboardingProcessingScreen", params: { applicationId } },
        ],
      }),
    )
  }

  /** A second tap in the same frame lands before the spinner shows. Sent again, the
   *  application would be refused as a duplicate and read as a failure. */
  const handleAccept = () => {
    if (isAcceptingRef.current) return
    isAcceptingRef.current = true
    const attempt: SendAttempt = { isAbandoned: false }
    pendingSendRef.current = attempt
    sendApplication(attempt).finally(() => {
      isAcceptingRef.current = false
      const isStillPending = pendingSendRef.current === attempt
      if (isStillPending) pendingSendRef.current = null
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
            isChecked={isESignAccepted}
            onPress={() => setIsESignAccepted(!isESignAccepted)}
            gap={CHECKBOX_GAP}
            labelLineHeight={CHECKBOX_LINE_HEIGHT}
          >
            {acknowledgementLL.eSignConsent.text()}{" "}
            <Text
              bold
              color={colors.accent}
              onPress={() => openExternalUrl(cardESignConsentUrl)}
            >
              {acknowledgementLL.eSignConsent.linkText()}
            </Text>
          </CheckboxRow>

          <CheckboxRow
            isChecked={isPrivacyAndTermsAccepted}
            onPress={() => setIsPrivacyAndTermsAccepted(!isPrivacyAndTermsAccepted)}
            gap={CHECKBOX_GAP}
            labelLineHeight={CHECKBOX_LINE_HEIGHT}
          >
            {acknowledgementLL.privacyAndTerms.text()}{" "}
            <Text
              bold
              color={colors.accent}
              onPress={() => openExternalUrl(cardIssuerPrivacyPolicyUrl)}
            >
              {acknowledgementLL.privacyAndTerms.privacyPolicyLinkText()}
            </Text>
            {acknowledgementLL.privacyAndTerms.and()}{" "}
            <Text
              bold
              color={colors.accent}
              onPress={() => openExternalUrl(cardCardholderAgreementUrl)}
            >
              {acknowledgementLL.privacyAndTerms.cardTermsLinkText()}
            </Text>
          </CheckboxRow>

          <CheckboxRow
            isChecked={isAccuracyCertified}
            onPress={() => setIsAccuracyCertified(!isAccuracyCertified)}
            gap={CHECKBOX_GAP}
            labelLineHeight={CHECKBOX_LINE_HEIGHT}
          >
            {acknowledgementLL.certifyAccuracy()}
          </CheckboxRow>

          <CheckboxRow
            isChecked={isSolicitationAcknowledged}
            onPress={() => setIsSolicitationAcknowledged(!isSolicitationAcknowledged)}
            gap={CHECKBOX_GAP}
            labelLineHeight={CHECKBOX_LINE_HEIGHT}
          >
            {acknowledgementLL.acknowledgeSolicitation()}
          </CheckboxRow>
        </View>
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(() => ({
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
}))
