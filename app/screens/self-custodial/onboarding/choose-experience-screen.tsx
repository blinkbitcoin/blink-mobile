import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { AnonModeConvertModal } from "@app/components/anon-mode-convert-modal"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { WalletCurrency } from "@app/graphql/generated"
import {
  canGoBackFromChooseExperience,
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { armModeSelectionConversion } from "@app/screens/conversion-flow/drain-conversion"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "./layouts"

const MODE_ICON_SIZE = 22

/** The actions a user's own back press dispatches, and the only ones this screen refuses:
 *  the header arrow and the Android hardware back raise GO_BACK, the swipe raises POP. */
const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

/**
 * Lets a self-custodial user pick their region posture (Enhanced or Anon). The settings
 * entry edits the active account in place; onboarding entries forward to the destination
 * their caller passed, so the same screen serves creation, restore and migration.
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
  const { accountMode, getModeFor, setAccountMode, setActiveAccountMode } =
    useSelfCustodialAccountMode()
  const { wallets, isReady: isWalletReady } = useActiveWallet()
  const { refreshWallets } = useSelfCustodialWallet()
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false)

  /** Null on the settings entry; the onboarding entries carry their onward step. */
  const onContinue = "entry" in route.params ? null : route.params.onContinue
  const isSettingsEntry = onContinue === null
  /** Carried back by the drain conversion, so the interrupted switch resumes selected. */
  const settingsInitialMode =
    "entry" in route.params ? route.params.initialMode ?? null : null

  /** Settings preselects the active account's mode; a restore that already knows its
   *  account honors that account's stored mode. Re-entry (a back press out of the next
   *  screen, or a migration resume onto this one) must not silently downgrade a
   *  deliberate Anon to the Enhanced default. Creation has no account to read yet. */
  const storedOnboardingMode =
    onContinue && "accountId" in onContinue ? getModeFor(onContinue.accountId) : null
  const initialMode = onContinue
    ? storedOnboardingMode ?? AccountMode.Enhanced
    : settingsInitialMode ?? accountMode ?? AccountMode.Enhanced
  const [selected, setSelected] = useState<AccountMode>(initialMode)

  /** The settings gate decides on the live balance, so it is refreshed on entry. */
  useEffect(() => {
    if (isSettingsEntry) refreshWallets().catch(() => undefined)
  }, [isSettingsEntry, refreshWallets])

  const usdWallet = wallets.find((wallet) => wallet.walletCurrency === WalletCurrency.Usd)
  const hasDollarBalance = (usdWallet?.balance.amount ?? 0) > 0
  /** The settings entry gates the Anon switch on the live balance, which is unknown
   *  until the wallet syncs: wait rather than let a cold start skip the gate. */
  const isContinueWaiting = !onContinue && !isWalletReady

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

  const goToDollarTransfer = () => {
    setIsConvertModalVisible(false)
    armModeSelectionConversion()
    navigation.navigate("conversionDetails")
  }

  const handleContinue = () => {
    if (!onContinue) {
      const isSwitchingToAnon =
        selected === AccountMode.Anon && accountMode !== AccountMode.Anon
      const isBalanceUnknown = !isWalletReady
      /** A remaining (or still unknown) dollar balance must be converted before it
       *  disappears behind Anon. */
      if (isSwitchingToAnon && (hasDollarBalance || isBalanceUnknown)) {
        setIsConvertModalVisible(true)
        return
      }
      const isModeUnchanged = selected === accountMode
      if (isModeUnchanged) {
        navigation.goBack()
        return
      }
      setActiveAccountMode(selected)
      navigation.replace("selfCustodialModeSwitchSuccess", { mode: selected })
      return
    }

    switch (onContinue.route) {
      /** Creation has no account yet, so the mode rides through terms to wallet creation. */
      case ChooseExperienceContinueRoute.AcceptTerms:
        navigation.navigate("acceptTermsAndConditions", {
          flow: "selfCustodial",
          mode: selected,
        })
        return
      case ChooseExperienceContinueRoute.BackupSuccess:
        setAccountMode(onContinue.accountId, selected)
        navigation.navigate("selfCustodialBackupSuccess")
        return
      case ChooseExperienceContinueRoute.BalancesOverview:
        setAccountMode(onContinue.accountId, selected)
        navigation.navigate("accountMigrationBalancesOverview")
        return
      default: {
        const _exhaustive: never = onContinue
        return _exhaustive
      }
    }
  }

  return (
    <OnboardingScreenLayout
      footer={
        <GaloyPrimaryButton
          title={LLScreen.continueButton()}
          onPress={handleContinue}
          disabled={isContinueWaiting}
          loading={isContinueWaiting}
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

      {isConvertModalVisible && (
        <AnonModeConvertModal
          isVisible={isConvertModalVisible}
          toggleModal={() => setIsConvertModalVisible(false)}
          onTransfer={goToDollarTransfer}
        />
      )}
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  options: {
    marginTop: 30,
  },
}))
