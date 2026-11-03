import React, { useCallback, useEffect, useLayoutEffect } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Divider, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { headerBackControl } from "@app/components/header-back-control/header-back-control"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useTwoFactorFlowExit } from "@app/custodial/hooks/use-two-factor-flow-exit"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

type Benefit = {
  icon: IconNamesType
  title: string
  description: string
}

const BENEFIT_ICON_SIZE = 20
const DIVIDER_WIDTH = 1

/**
 * The first screen of the authenticator onboarding, opened by every prompt's Set
 * authenticator: why an authenticator, before the app to get and the key to copy.
 * Backing out of it, by the header's arrow or the hardware back, leaves the onboarding
 * unfinished, which is the dismissal of the prompt that opened it; the swipe is off for
 * this route, so no exit skips the count.
 */
export const AuthenticatorIntroScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationIntro">
    >()
  const { params } = useRoute<RouteProp<RootStackParamList, "totpRegistrationIntro">>()
  const { promptTier, leave } = useTwoFactorFlowExit(params)

  useHardwareBackGuard(leave)

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: headerBackControl({ onPress: leave }) })
  }, [navigation, leave])

  /** Every Set authenticator lands here, so this is where the setup starts. */
  useEffect(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
  }, [promptTier])

  const handleGetStarted = useCallback(() => {
    navigation.navigate("totpRegistrationApps")
  }, [navigation])

  const benefits: Benefit[] = [
    {
      icon: "warning",
      title: LL.AuthenticatorOnboarding.takeoversTitle(),
      description: LL.AuthenticatorOnboarding.takeoversDescription(),
    },
    {
      icon: "shield",
      title: LL.AuthenticatorOnboarding.stolenNumberTitle(),
      description: LL.AuthenticatorOnboarding.stolenNumberDescription(),
    },
    {
      icon: "clock",
      title: LL.AuthenticatorOnboarding.durationTitle(),
      description: LL.AuthenticatorOnboarding.durationDescription(),
    },
  ]

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AuthenticatorOnboarding.getStarted()}
          onPress={handleGetStarted}
          {...testProps("authenticator-intro-get-started")}
        />
      }
    >
      <IconHero
        icon="lock-closed"
        iconColor={colors._green}
        title={LL.AuthenticatorOnboarding.introTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.AuthenticatorOnboarding.introDescription()}
          </Text>
        }
      />
      <View style={styles.benefitsCard} {...testProps("authenticator-intro-benefits")}>
        {benefits.map((benefit, index) => (
          <React.Fragment key={benefit.icon}>
            {index > 0 && (
              <Divider
                color={colors.grey4}
                width={DIVIDER_WIDTH}
                style={styles.divider}
              />
            )}
            <SettingItemRow
              leftIcon={benefit.icon}
              leftIconSize={BENEFIT_ICON_SIZE}
              title={benefit.title}
              subtitle={benefit.description}
              rightIcon={null}
              containerStyle={styles.benefitRow}
            />
          </React.Fragment>
        ))}
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
  /** On the static card surface: the benefits are read, never pressed. */
  benefitsCard: {
    marginTop: 30,
    marginHorizontal: 20,
    backgroundColor: colors.grey7,
    borderRadius: 8,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: 10,
  },
  benefitRow: {
    backgroundColor: colors.transparent,
    borderRadius: 0,
  },
}))
