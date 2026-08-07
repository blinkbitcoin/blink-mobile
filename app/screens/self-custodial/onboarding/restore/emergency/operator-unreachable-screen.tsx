import React from "react"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../../layouts"

type OperatorUnreachableRouteProp = RouteProp<
  RootStackParamList,
  "selfCustodialOperatorUnreachable"
>

/**
 * Restore could not reach the Spark operators.
 *
 * This is deliberately not the generic restore failure: a typo'd phrase and an
 * operator outage look identical from inside the catch, and telling an outage
 * victim to check their phrase sends them looking for a mistake they did not
 * make. The one thing still possible without operators is verifying an
 * emergency bundle against the phrase, which is what the second link offers.
 */
export const OperatorUnreachableScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { mnemonic } = useRoute<OperatorUnreachableRouteProp>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.EmergencyRecovery.tryAgainLater()}
            onPress={navigation.goBack}
            {...testProps("outage-try-again-button")}
          />
          <GaloySecondaryButton
            title={LL.common.close()}
            onPress={() => navigation.navigate("selfCustodialRestoreMethod")}
            {...testProps("outage-close-button")}
          />
        </>
      }
    >
      <IconHero
        icon="asterisk"
        iconColor={colors.error}
        title={LL.EmergencyRecovery.outageTitle()}
        subtitle={
          <Text style={styles.body}>
            {LL.EmergencyRecovery.outageBody({ support: "" })}
            <Text
              style={styles.link}
              onPress={() => navigation.navigate("onboarding", { screen: "supportScreen" })}
              {...testProps("outage-support-link")}
            >
              {LL.EmergencyRecovery.outageSupport()}
            </Text>
          </Text>
        }
      />

      <Text
        style={styles.recoveryLink}
        onPress={() => navigation.navigate("selfCustodialEmergencyRecovery", { mnemonic })}
        {...testProps("outage-emergency-recovery-link")}
      >
        {LL.EmergencyRecovery.outageCta()}
      </Text>
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  link: {
    textDecorationLine: "underline",
  },
  recoveryLink: {
    marginTop: 24,
    textAlign: "center",
    textDecorationLine: "underline",
    fontSize: 16,
    lineHeight: 24,
  },
}))
