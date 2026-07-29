import React, { useState } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"
import { useSelfCustodialAccountMode } from "@app/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { AccountMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "./layouts"

/**
 * Lets a self-custodial user pick their region posture (Enhanced or Anon) during
 * onboarding. On continue it forwards to the destination its caller passed, so the same
 * screen serves creation, restore and migration.
 */
export const ChooseExperienceScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const LLScreen = LL.ChooseExperienceScreen
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "selfCustodialChooseExperience">>()
  const { setAccountMode } = useSelfCustodialAccountMode()

  const [selected, setSelected] = useState<AccountMode>(AccountMode.Enhanced)

  const options: OptionCard<AccountMode>[] = [
    {
      key: AccountMode.Enhanced,
      icon: "map-pin",
      title: LLScreen.enhancedLabel(),
      description: LLScreen.enhancedDescription(),
      testID: "mode-enhanced",
    },
    {
      key: AccountMode.Anon,
      icon: "eye-slash",
      title: LLScreen.anonLabel(),
      description: LLScreen.anonDescription(),
      testID: "mode-anon",
    },
  ]

  const handleContinue = () => {
    const { onContinue } = route.params

    /** Creation has no account yet, so the mode rides through terms to wallet creation. */
    if (onContinue.route === ChooseExperienceContinueRoute.AcceptTerms) {
      navigation.navigate("acceptTermsAndConditions", {
        flow: "selfCustodial",
        mode: selected,
      })
      return
    }

    setAccountMode(onContinue.accountId, selected)

    if (onContinue.route === ChooseExperienceContinueRoute.BackupSuccess) {
      navigation.navigate("selfCustodialBackupSuccess")
      return
    }
    navigation.navigate("accountMigrationBalancesOverview")
  }

  return (
    <OnboardingScreenLayout
      headerless
      footer={
        <GaloyPrimaryButton
          title={LLScreen.continueButton()}
          onPress={handleContinue}
          {...testProps("choose-experience-continue")}
        />
      }
    >
      <IconHero
        icon="map-pin"
        iconColor={colors.primary}
        title={LLScreen.title()}
        subtitle={LLScreen.subtitle()}
      />

      <View style={styles.options}>
        <OptionCardGroup
          options={options}
          selectedKey={selected}
          onSelect={setSelected}
        />
      </View>
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  options: {
    marginTop: 30,
  },
}))
