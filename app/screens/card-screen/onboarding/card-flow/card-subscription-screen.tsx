import * as React from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SubscriptionOfferCard } from "@app/components/card-screen"
import { CheckboxRow } from "@app/components/card-screen/checkbox-row"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useKycFlow } from "@app/hooks"
import { KycFlowType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { openExternalUrl } from "@app/utils/external"

import {
  SUBSCRIPTION_RENEWAL_MONTHS,
  useSubscriptionOffer,
} from "./use-subscription-offer"

const SUBSCRIBE_ROUTE: keyof RootStackParamList = "cardOnboardingSubscribeScreen"

export const CardSubscriptionScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const route = useRoute<RouteProp<RootStackParamList>>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const isSubscribeVariant = route.name === SUBSCRIBE_ROUTE

  const { cardTermsAndConditionsUrl, cardPrivacyPolicyUrl, cardCardholderAgreementUrl } =
    useRemoteConfig()
  const { isFree, ...offerCard } = useSubscriptionOffer({ isSubscribeVariant })

  const { startKyc } = useKycFlow({
    type: KycFlowType.Card,
    headerTitle: LL.CardFlow.Onboarding.kycHeaderTitle(),
  })

  const [isNoticeAccepted, setIsNoticeAccepted] = React.useState(false)
  const [isFeeScheduleAgreed, setIsFeeScheduleAgreed] = React.useState(false)
  const [isAgreed, setIsAgreed] = React.useState(false)

  const isSubscribeReady = isNoticeAccepted && isFeeScheduleAgreed
  const isAcceptDisabled = isSubscribeVariant ? !isSubscribeReady : !isAgreed

  /** The free offer has nothing to subscribe to yet, so its header carries no title. Set
   *  both ways, since the price comes from Remote Config and can change while mounted. */
  const subscribeHeaderTitle = isFree
    ? ""
    : LL.CardFlow.Onboarding.CardSubscription.subscribeTitle()
  React.useLayoutEffect(() => {
    if (isSubscribeVariant) {
      navigation.setOptions({ title: subscribeHeaderTitle })
    }
  }, [isSubscribeVariant, navigation, subscribeHeaderTitle])

  const noticeText = isFree
    ? LL.CardFlow.Onboarding.CardSubscription.freeNotice()
    : LL.CardFlow.Onboarding.CardSubscription.renew({
        months: SUBSCRIPTION_RENEWAL_MONTHS,
      })

  const handleAccept = () => {
    if (isSubscribeVariant) {
      startKyc()
      return
    }

    console.log("TODO: payment flow")
  }

  return (
    <Screen>
      <View style={styles.contentContainer}>
        <SubscriptionOfferCard {...offerCard} />

        {isSubscribeVariant && (
          <>
            <CheckboxRow
              checked={isNoticeAccepted}
              onPress={() => setIsNoticeAccepted(!isNoticeAccepted)}
            >
              <Text type="p3" style={styles.agreementText}>
                {noticeText}
              </Text>
            </CheckboxRow>

            <CheckboxRow
              checked={isFeeScheduleAgreed}
              onPress={() => setIsFeeScheduleAgreed(!isFeeScheduleAgreed)}
            >
              <Text type="p3" style={styles.agreementText}>
                {LL.CardFlow.Onboarding.CardSubscription.feeSchedule.text()}{" "}
                <Text
                  type="p3"
                  bold
                  color={colors.accent}
                  style={styles.agreementText}
                  onPress={() => navigation.navigate("cardFeeScheduleScreen")}
                >
                  {LL.CardFlow.Onboarding.CardSubscription.feeSchedule.linkText()}
                </Text>
              </Text>
            </CheckboxRow>
          </>
        )}

        {!isSubscribeVariant && (
          <CheckboxRow checked={isAgreed} onPress={() => setIsAgreed(!isAgreed)}>
            <Text type="p3" style={styles.agreementText}>
              {LL.CardFlow.Onboarding.CardSubscription.agreement.text()}{" "}
              <Text
                bold
                color={colors.accent}
                onPress={() => openExternalUrl(cardTermsAndConditionsUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.termsOfService()}
              </Text>
              ,{" "}
              <Text
                bold
                color={colors.accent}
                onPress={() => openExternalUrl(cardPrivacyPolicyUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.privacyPolicy()}
              </Text>
              , {LL.CardFlow.Onboarding.CardSubscription.agreement.and()}{" "}
              <Text
                bold
                color={colors.accent}
                onPress={() => openExternalUrl(cardCardholderAgreementUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.cardholderAgreement()}
              </Text>
            </Text>
          </CheckboxRow>
        )}
      </View>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={
            isSubscribeVariant
              ? LL.CardFlow.Onboarding.CardSubscription.acceptButton()
              : LL.CardFlow.Onboarding.CardSubscription.payButton()
          }
          onPress={handleAccept}
          disabled={isAcceptDisabled}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    gap: 20,
  },
  agreementText: {
    lineHeight: 16,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
