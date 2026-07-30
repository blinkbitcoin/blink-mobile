import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  canGoBackFromChooseExperience,
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { AccountMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "./layouts"

const MODE_ICON_SIZE = 22

/** The actions a user's own back press dispatches, and the only ones this screen refuses:
 *  the header arrow and the Android hardware back raise GO_BACK, the swipe raises POP. */
const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

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
  const { getModeFor, setAccountMode } = useSelfCustodialAccountMode()

  const { onContinue } = route.params
  const isAccountPending = onContinue.route === ChooseExperienceContinueRoute.AcceptTerms
  /** Re-entry (a back press out of the next screen, or a migration resume onto this
   *  screen) must not silently downgrade a deliberate Anon to the Enhanced default, so
   *  seed from what the account already stored. Creation has no account to read yet. */
  const storedMode = isAccountPending ? null : getModeFor(onContinue.accountId)

  const [selected, setSelected] = useState<AccountMode>(
    storedMode ?? AccountMode.Enhanced,
  )

  /**
   * Restore and migration arrive with the account already activated and only the screen
   * ahead resetting to Primary, so leaving backwards would strand a live account on an
   * onboarding screen with no mode recorded. Guarding through the navigator rather than the
   * hidden header arrow alone is deliberate: `beforeRemove` also catches the Android
   * hardware back, which suppressing the arrow does not.
   *
   * Only the backward actions are refused. A removal this screen did not cause, an app-lock
   * or migration-gate reset, has to keep working, and blocking those is how a guard meant
   * to protect the user ends up trapping them instead.
   */
  useEffect(() => {
    if (canGoBackFromChooseExperience(onContinue)) return
    return navigation.addListener("beforeRemove", (event) => {
      if (!BACKWARD_ACTIONS.includes(event.data.action.type)) return
      event.preventDefault()
    })
  }, [navigation, onContinue])

  const options: OptionCard<AccountMode>[] = [
    {
      key: AccountMode.Enhanced,
      icon: "magic-wand",
      iconSize: MODE_ICON_SIZE,
      title: LLScreen.enhancedLabel(),
      description: LLScreen.enhancedDescription(),
      testID: "mode-enhanced",
    },
    {
      key: AccountMode.Anon,
      icon: "sunglasses",
      iconSize: MODE_ICON_SIZE,
      title: LLScreen.anonLabel(),
      description: LLScreen.anonDescription(),
      testID: "mode-anon",
    },
  ]

  const handleContinue = () => {
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
      footer={
        <GaloyPrimaryButton
          title={LLScreen.continueButton()}
          onPress={handleContinue}
          {...testProps("choose-experience-continue")}
        />
      }
    >
      <IconHero
        icon="spinner"
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
