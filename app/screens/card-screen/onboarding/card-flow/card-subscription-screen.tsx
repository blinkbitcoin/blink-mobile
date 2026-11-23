import * as React from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SubscriptionOfferCard } from "@app/components/card-screen"
import { CheckboxRow } from "@app/components/checkbox-row"
import { StepLayout } from "@app/components/step-layout"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { openExternalUrl } from "@app/utils/external"

import {
  SUBSCRIPTION_RENEWAL_MONTHS,
  useSubscriptionOffer,
} from "./use-subscription-offer"

const SUBSCRIBE_ROUTE: keyof RootStackParamList = "cardOnboardingSubscribeScreen"

/** The design's checkbox row: 14 between the box and its text, set at 14/16. */
const CHECKBOX_GAP = 14
const CHECKBOX_LINE_HEIGHT = 16

const Notice = {
  Free: "free",
  Paid: "paid",
} as const

type NoticeType = (typeof Notice)[keyof typeof Notice]

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

  /** The price comes from Remote Config and can change while mounted, so the notice
   *  is accepted by variant: a checked free notice does not accept the paid one. */
  const [acceptedNotice, setAcceptedNotice] = React.useState<NoticeType | null>(null)
  const notice = isFree ? Notice.Free : Notice.Paid
  const isNoticeAccepted = acceptedNotice === notice
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

  const toggleNotice = () => setAcceptedNotice(isNoticeAccepted ? null : notice)

  const handleAccept = () => {
    if (isSubscribeVariant) {
      navigation.navigate("cardOnboardingVerifyIdentityScreen")
      return
    }

    console.log("TODO: payment flow")
  }

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={
            isSubscribeVariant
              ? LL.CardFlow.Onboarding.CardSubscription.acceptButton()
              : LL.CardFlow.Onboarding.CardSubscription.payButton()
          }
          onPress={handleAccept}
          disabled={isAcceptDisabled}
        />
      }
    >
      <View style={styles.content}>
        <SubscriptionOfferCard {...offerCard} />

        {isSubscribeVariant && (
          <>
            <CheckboxRow
              isChecked={isNoticeAccepted}
              onPress={toggleNotice}
              gap={CHECKBOX_GAP}
              labelLineHeight={CHECKBOX_LINE_HEIGHT}
            >
              {noticeText}
            </CheckboxRow>

            <CheckboxRow
              isChecked={isFeeScheduleAgreed}
              onPress={() => setIsFeeScheduleAgreed(!isFeeScheduleAgreed)}
              gap={CHECKBOX_GAP}
              labelLineHeight={CHECKBOX_LINE_HEIGHT}
            >
              {LL.CardFlow.Onboarding.CardSubscription.feeSchedule.text()}{" "}
              <Text
                bold
                color={colors.accent}
                onPress={() => navigation.navigate("cardFeeScheduleScreen")}
              >
                {LL.CardFlow.Onboarding.CardSubscription.feeSchedule.linkText()}
              </Text>
            </CheckboxRow>
          </>
        )}

        {!isSubscribeVariant && (
          <CheckboxRow
            isChecked={isAgreed}
            onPress={() => setIsAgreed(!isAgreed)}
            gap={CHECKBOX_GAP}
            labelLineHeight={CHECKBOX_LINE_HEIGHT}
          >
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
          </CheckboxRow>
        )}
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(() => ({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 20,
  },
}))
