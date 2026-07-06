import * as React from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/card-screen/checkbox-row"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useKycFlow } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { KycFlowType, WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatDateFromNow } from "@app/utils/date"
import { openExternalUrl } from "@app/utils/external"

const SUBSCRIBE_ROUTE: keyof RootStackParamList = "cardOnboardingSubscribeScreen"
const SUBSCRIPTION_RENEWAL_MONTHS = 12

export const CardSubscriptionScreen: React.FC = () => {
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const route = useRoute<RouteProp<RootStackParamList>>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const isSubscribeVariant = route.name === SUBSCRIBE_ROUTE

  const {
    cardTermsAndConditionsUrl,
    cardPrivacyPolicyUrl,
    cardCardholderAgreementUrl,
    cardSubscriptionPriceUsd,
  } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()

  const { startKyc } = useKycFlow({
    type: KycFlowType.Card,
    headerTitle: LL.CardFlow.Onboarding.kycHeaderTitle(),
  })

  const price = React.useMemo(
    () =>
      formatCurrency({
        amountInMajorUnits: cardSubscriptionPriceUsd,
        currency: WalletCurrency.Usd,
      }),
    [formatCurrency, cardSubscriptionPriceUsd],
  )

  const renewalDate = React.useMemo(
    () => formatDateFromNow({ months: SUBSCRIPTION_RENEWAL_MONTHS, locale }),
    [locale],
  )

  const [isAgreed, setIsAgreed] = React.useState(false)
  const [isRenew, setIsRenew] = React.useState(false)
  const [isFeeScheduleAgreed, setIsFeeScheduleAgreed] = React.useState(false)

  const isSubscribeReady = isRenew && isFeeScheduleAgreed && isAgreed
  const isAcceptDisabled = isSubscribeVariant ? !isSubscribeReady : !isAgreed

  const statusLabel = isSubscribeVariant
    ? LL.CardFlow.Onboarding.CardSubscription.status.specialOfferLabel()
    : LL.CardFlow.Onboarding.CardSubscription.status.label()

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
        <View style={styles.cardContainer}>
          <Text type="p2" style={styles.cardTitle}>
            {LL.CardFlow.Onboarding.CardSubscription.cardTitle()}
          </Text>

          <Text type="h1" style={styles.price}>
            {price}
          </Text>

          <Text type="p3" style={styles.perYear}>
            {LL.CardFlow.Onboarding.CardSubscription.perYear()}
          </Text>

          <View style={styles.infoRow}>
            <Text type="p3" style={styles.label}>
              {statusLabel}
            </Text>
            {isSubscribeVariant ? (
              <Text type="p3" style={styles.statusSubscribe}>
                {LL.CardFlow.Onboarding.CardSubscription.status.firstYearFree()}
              </Text>
            ) : (
              <Text type="p3" style={styles.statusPending}>
                {LL.CardFlow.Onboarding.CardSubscription.status.paymentPending()}
              </Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text type="p3" style={styles.label}>
              {LL.CardFlow.Onboarding.CardSubscription.renewalDate.label()}
            </Text>
            <Text type="p3" style={styles.value}>
              {renewalDate}
            </Text>
          </View>
        </View>

        <View style={styles.checkboxesContainer}>
          {isSubscribeVariant && (
            <>
              <CheckboxRow checked={isRenew} onPress={() => setIsRenew(!isRenew)}>
                <Text type="p3" style={styles.agreementText}>
                  {LL.CardFlow.Onboarding.CardSubscription.renew({
                    months: SUBSCRIPTION_RENEWAL_MONTHS,
                  })}
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
                    style={styles.feeScheduleLink}
                    onPress={() => navigation.navigate("cardFeeScheduleScreen")}
                  >
                    {LL.CardFlow.Onboarding.CardSubscription.feeSchedule.linkText()}
                  </Text>
                </Text>
              </CheckboxRow>
            </>
          )}

          <CheckboxRow checked={isAgreed} onPress={() => setIsAgreed(!isAgreed)}>
            <Text type="p3" style={styles.agreementText}>
              {LL.CardFlow.Onboarding.CardSubscription.agreement.text()}{" "}
              <Text
                style={styles.link}
                onPress={() => openExternalUrl(cardTermsAndConditionsUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.termsOfService()}
              </Text>
              ,{" "}
              <Text
                style={styles.link}
                onPress={() => openExternalUrl(cardPrivacyPolicyUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.privacyPolicy()}
              </Text>
              , {LL.CardFlow.Onboarding.CardSubscription.agreement.and()}{" "}
              <Text
                style={styles.link}
                onPress={() => openExternalUrl(cardCardholderAgreementUrl)}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.cardholderAgreement()}
              </Text>
            </Text>
          </CheckboxRow>
        </View>
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

const useStyles = makeStyles(({ colors }) => ({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  cardContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 16,
    padding: 18,
    paddingBottom: 5,
  },
  cardTitle: {
    color: colors.black,
    textAlign: "center",
    marginBottom: 5,
    fontWeight: "700",
    lineHeight: 22,
  },
  price: {
    color: colors.primary,
    textAlign: "center",
    marginBottom: 5,
    fontWeight: "700",
    lineHeight: 32,
  },
  perYear: {
    color: colors.grey2,
    textAlign: "center",
    marginBottom: 15,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  label: {
    color: colors.grey2,
    lineHeight: 20,
  },
  statusPending: {
    color: colors.primary,
    fontWeight: "700",
    lineHeight: 20,
  },
  statusSubscribe: {
    color: colors._green,
    fontWeight: "700",
    lineHeight: 20,
  },
  value: {
    color: colors.black,
    fontWeight: "700",
    lineHeight: 20,
  },
  checkboxesContainer: {
    marginTop: 17,
    gap: 17,
  },
  agreementText: {
    color: colors.black,
    lineHeight: 16,
  },
  link: {
    color: colors.primary,
    fontWeight: "500",
  },
  feeScheduleLink: {
    color: colors.primary,
    fontWeight: "700",
    lineHeight: 16,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
