import * as React from "react"
import { View } from "react-native"
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Divider, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { KycFlowType } from "@app/graphql/generated"
import { useKycFlow } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { staticSurface } from "@app/rne-theme/surfaces"

import { useCardKycStatus } from "./use-card-kyc-status"

type Requirement = {
  icon: IconNamesType
  title: string
}

const DIVIDER_WIDTH = 1

/** Tells the user what the card issuer's verification asks for before it starts. */
export const CardVerifyIdentityScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isFocused = useIsFocused()

  const { startKyc, loading: isStartingKyc } = useKycFlow({
    type: KycFlowType.Card,
    headerTitle: LL.CardFlow.Onboarding.kycHeaderTitle(),
  })
  const { readKycStatus, isKycSubmitted, isCheckingKyc } = useCardKycStatus()

  /** The verification web flow tells the app nothing when it ends, so the step reads the
   *  issuer's review whenever the user is back on it: on the way back from the web flow,
   *  or on a later visit after the app was closed past it. */
  useFocusEffect(
    React.useCallback(() => {
      readKycStatus()
    }, [readKycStatus]),
  )

  /** Replaced rather than pushed: a submitted verification is never started again. */
  React.useEffect(() => {
    if (!isFocused || !isKycSubmitted) return
    navigation.replace("cardOnboardingPersonalInfoScreen")
  }, [isFocused, isKycSubmitted, navigation])

  const isContinueLoading = isCheckingKyc || isStartingKyc

  const requirements: Requirement[] = [
    {
      icon: "card",
      title: LL.CardFlow.Onboarding.CardVerifyIdentity.requirements.governmentId(),
    },
    {
      icon: "user",
      title: LL.CardFlow.Onboarding.CardVerifyIdentity.requirements.selfie(),
    },
    {
      icon: "house-outline",
      title: LL.CardFlow.Onboarding.CardVerifyIdentity.requirements.proofOfAddress(),
    },
    {
      icon: "question",
      title: LL.CardFlow.Onboarding.CardVerifyIdentity.requirements.questions(),
    },
  ]

  const handleContinue = () => {
    startKyc()
  }

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardVerifyIdentity.buttonText()}
          onPress={handleContinue}
          loading={isContinueLoading}
        />
      }
    >
      <View style={styles.content}>
        <IconHero
          icon="document-outline"
          iconColor={colors.success}
          title={LL.CardFlow.Onboarding.CardVerifyIdentity.title()}
          subtitle={
            <Text type="p3" style={styles.description}>
              {LL.CardFlow.Onboarding.CardVerifyIdentity.description()}
            </Text>
          }
        />
        <View style={styles.requirementsCard}>
          {requirements.map((requirement, index) => {
            const hasDivider = index > 0

            return (
              <React.Fragment key={requirement.icon}>
                {hasDivider && (
                  <Divider
                    color={colors.neutral}
                    width={DIVIDER_WIDTH}
                    style={styles.divider}
                  />
                )}
                <SettingItemRow
                  leftIcon={requirement.icon}
                  title={requirement.title}
                  rightIcon={null}
                  titleStyle={styles.requirementTitle}
                />
              </React.Fragment>
            )
          })}
        </View>
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  /** On top of the hero's own 20, so it sits 30 below the header like the other card steps. */
  content: {
    paddingTop: 10,
  },
  description: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  /** On the static card surface: the requirements are read, never pressed. */
  requirementsCard: {
    marginTop: 30,
    marginHorizontal: 20,
    ...staticSurface(colors),
    borderRadius: 8,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: 10,
  },
  requirementTitle: {
    lineHeight: 18,
  },
}))
