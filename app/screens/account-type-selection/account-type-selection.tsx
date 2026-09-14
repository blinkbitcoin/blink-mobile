import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"
import { Screen } from "@app/components/screen"
import {
  ACCOUNT_OPTION_TO_FLOW,
  AccountOption,
  useAccountTypeOptions,
} from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { AccountTypeMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"

import { PhoneLoginInitiateType } from "../phone-auth-screen"

/** Ordered here rather than by the options list, so the cards keep a stable place. */
const CARD_ORDER = [AccountOption.Custodial, AccountOption.SelfCustodial]

export const AccountTypeSelectionScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "accountTypeSelection">>()
  const { mode } = route.params
  const isCreateMode = mode === AccountTypeMode.Create
  const { options, defaultSelected, selfCustodialTemporarilyDisabled } =
    useAccountTypeOptions()
  const { checkBlockReason, isChecking, isFirstSignupRuleReady } = useCreationBlock()
  const isMounted = useIsMounted()
  const [selected, setSelected] = useState<AccountOption | null>(defaultSelected)

  useEffect(() => {
    if (defaultSelected && !selected) setSelected(defaultSelected)
  }, [defaultSelected, selected])

  const handleContinue = async () => {
    if (!selected) return

    if (isCreateMode) {
      /** Self-custodial is answered after the mode screen instead: Anon reads no location
       *  at all, and the mode is not chosen yet. */
      if (selected === AccountOption.SelfCustodial) {
        navigation.navigate("selfCustodialChooseExperience", {
          onContinue: { route: ChooseExperienceContinueRoute.AcceptTerms },
        })
        return
      }
      const blockReason = await checkBlockReason(selected)
      if (!isMounted()) return
      if (blockReason) {
        navigation.navigate("unsupportedRegion", { reason: blockReason })
        return
      }
      navigation.navigate("acceptTermsAndConditions", {
        flow: ACCOUNT_OPTION_TO_FLOW[selected],
      })
      return
    }

    if (selected === AccountOption.Custodial) {
      navigation.navigate("login", {
        type: PhoneLoginInitiateType.Login,
      })
      return
    }

    navigation.navigate("selfCustodialRestoreMethod")
  }

  /** The account count behind `isFirstSignupRuleReady` is read by one path only: the
   *  custodial creation, whose first-signup rule needs it. Restore navigates straight to
   *  login or the restore method, and a self-custodial creation is answered after the mode
   *  screen, so neither ever asks. Waiting on it in those modes disabled Continue over a
   *  rule that was never going to be consulted, and the registry re-hydrates whenever the
   *  active account changes, so the wait could return mid-session and swallow a press. */
  const isFirstSignupRuleConsulted = isCreateMode && selected === AccountOption.Custodial
  const isRuleStillHydrating = isFirstSignupRuleConsulted && !isFirstSignupRuleReady
  const isContinueDisabled = !selected || isChecking || isRuleStillHydrating

  /** A selection changed mid-check would leave the answer describing the option the user
   *  moved away from, so the cards hold still until it lands. */
  const handleSelect = (option: AccountOption) => {
    if (isChecking) return
    setSelected(option)
  }

  const cardsByOption: Record<AccountOption, OptionCard<AccountOption>> = {
    [AccountOption.Custodial]: {
      key: AccountOption.Custodial,
      icon: "cloud",
      title: LL.AccountTypeSelectionScreen.custodialLabel(),
      description: LL.AccountTypeSelectionScreen.custodialDescription(),
      testID: "custodial-option",
    },
    [AccountOption.SelfCustodial]: {
      key: AccountOption.SelfCustodial,
      icon: "key-outline",
      title: LL.AccountTypeSelectionScreen.selfCustodialLabel(),
      description: LL.AccountTypeSelectionScreen.selfCustodialDescription(),
      testID: "self-custodial-option",
    },
  }

  const cardOptions = CARD_ORDER.filter((option) => options.includes(option)).map(
    (option) => cardsByOption[option],
  )

  return (
    <Screen>
      <View style={styles.wrapper}>
        <View style={styles.body}>
          <Text style={styles.description}>
            {isCreateMode
              ? LL.AccountTypeSelectionScreen.descriptionDefault()
              : LL.AccountTypeSelectionScreen.descriptionSelected()}
          </Text>

          {selfCustodialTemporarilyDisabled && (
            <View style={styles.banner} {...testProps("self-custodial-disabled-banner")}>
              <Text style={styles.bannerText}>
                {LL.AccountTypeSelectionScreen.selfCustodialDisabled()}
              </Text>
            </View>
          )}

          <OptionCardGroup
            options={cardOptions}
            selectedKey={selected}
            onSelect={handleSelect}
          />
        </View>

        <View style={styles.ctaContainer}>
          <GaloyPrimaryButton
            title={
              selected
                ? LL.AccountTypeSelectionScreen.continueButton()
                : LL.AccountTypeSelectionScreen.chooseMethod()
            }
            onPress={handleContinue}
            loading={isChecking}
            disabled={isContinueDisabled}
            {...testProps("continue-button")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrapper: {
    flex: 1,
    justifyContent: "space-between",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    marginBottom: 20,
  },
  banner: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.grey1,
    textAlign: "center",
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
