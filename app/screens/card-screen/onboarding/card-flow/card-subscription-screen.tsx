import * as React from "react"
import { View } from "react-native"
import { RouteProp, useRoute } from "@react-navigation/native"
import { CheckBox, makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useKycFlow } from "@app/hooks"
import { KycFlowType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatDateFromNow } from "@app/utils/date"

import { MOCK_CARD_PAYMENT } from "../onboarding-mock-data"

const SUBSCRIBE_ROUTE: keyof RootStackParamList = "cardOnboardingSubscribeScreen"

export const CardSubscriptionScreen: React.FC = () => {
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const route = useRoute<RouteProp<RootStackParamList>>()

  const isSubscribeVariant = route.name === SUBSCRIBE_ROUTE

  const { startKyc } = useKycFlow({
    type: KycFlowType.Card,
    headerTitle: LL.CardFlow.Onboarding.kycHeaderTitle(),
  })

  const renewalDate = formatDateFromNow(1, locale)

  const [isAgreed, setIsAgreed] = React.useState(false)
  const [isRenew, setIsRenew] = React.useState(false)

  const handleAccept = () => {
    if (!isAgreed) return
    if (isSubscribeVariant && !isRenew) return

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
            {MOCK_CARD_PAYMENT.price}
          </Text>

          <Text type="p3" style={styles.perYear}>
            {LL.CardFlow.Onboarding.CardSubscription.perYear()}
          </Text>

          <View style={styles.infoRow}>
            <Text type="p3" style={styles.label}>
              {LL.CardFlow.Onboarding.CardSubscription.status.label()}
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

        <View style={styles.checkboxContainer}>
          <CheckBox
            checked={isAgreed}
            iconType="ionicon"
            checkedIcon={"checkbox"}
            uncheckedIcon={"square-outline"}
            onPress={() => setIsAgreed(!isAgreed)}
            containerStyle={styles.checkboxStyle}
          />
          <View style={styles.agreementTextContainer}>
            <Text type="p3" style={styles.agreementText}>
              {LL.CardFlow.Onboarding.CardSubscription.agreement.text()}{" "}
              <Text
                style={styles.link}
                onPress={() => console.log("TODO: Terms of Service")}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.termsOfService()}
              </Text>
              ,{" "}
              <Text
                style={styles.link}
                onPress={() => console.log("TODO: Privacy Policy")}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.privacyPolicy()}
              </Text>
              , {LL.CardFlow.Onboarding.CardSubscription.agreement.and()}{" "}
              <Text
                style={styles.link}
                onPress={() => console.log("TODO: Cardholder Agreement")}
              >
                {LL.CardFlow.Onboarding.CardSubscription.agreement.cardholderAgreement()}
              </Text>
            </Text>
          </View>
        </View>
        {isSubscribeVariant && (
          <View style={styles.checkboxContainer}>
            <CheckBox
              checked={isRenew}
              iconType="ionicon"
              checkedIcon={"checkbox"}
              uncheckedIcon={"square-outline"}
              onPress={() => setIsRenew(!isRenew)}
              containerStyle={styles.checkboxStyle}
            />
            <View style={styles.agreementTextContainer}>
              <Text type="p3" style={styles.agreementText}>
                {LL.CardFlow.Onboarding.CardSubscription.renew()}
              </Text>
            </View>
          </View>
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
          disabled={!isAgreed || (isSubscribeVariant && !isRenew)}
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
    fontWeight: "600",
  },
  price: {
    color: colors.primary,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 5,
  },
  perYear: {
    color: colors.grey2,
    textAlign: "center",
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  label: {
    color: colors.grey2,
  },
  statusPending: {
    color: colors.primary,
    fontWeight: "500",
  },
  statusSubscribe: {
    color: colors._green,
    fontWeight: "500",
  },
  value: {
    color: colors.black,
    fontWeight: "500",
  },
  checkboxContainer: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxStyle: {
    padding: 0,
    margin: 0,
    marginRight: 15,
    marginLeft: 0,
  },
  agreementTextContainer: {
    flex: 1,
    marginTop: 2,
  },
  agreementText: {
    color: colors.black,
    lineHeight: 22,
  },
  link: {
    color: colors.primary,
    fontWeight: "500",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
