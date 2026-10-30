import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../../layouts"

/**
 * Restore could not reach the Spark operators.
 *
 * This is deliberately not the generic restore failure: a typo'd phrase and an
 * operator outage look identical from inside the catch, and telling an outage
 * victim to check their phrase sends them looking for a mistake they did not
 * make.
 */
export const OperatorUnreachableScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
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
              onPress={() =>
                navigation.navigate("onboarding", { screen: "supportScreen" })
              }
              {...testProps("outage-support-link")}
            >
              {LL.EmergencyRecovery.outageSupport()}
            </Text>
          </Text>
        }
      />
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
}))
