import React, { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { OptionCard, OptionCardGroup } from "@app/components/option-card-group"
import { Screen } from "@app/components/screen"
import {
  ACCOUNT_OPTION_TO_FLOW,
  AccountOption,
  useAccountTypeOptions,
} from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"
import { useEnhancedModePrompt } from "@app/components/enhanced-mode-prompt"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { AccountTypeMode } from "@app/types/account"
import { testProps } from "@app/utils/testProps"

import { PhoneLoginInitiateType } from "../phone-auth-screen"

export const AccountTypeSelectionScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "accountTypeSelection">>()
  const { mode } = route.params
  const isCreateMode = mode === AccountTypeMode.Create
  const {
    options,
    defaultSelected,
    selfCustodialTemporarilyDisabled,
    loading: detectingCountry,
  } = useAccountTypeOptions(mode)
  const { isCreationBlocked, loading: detectingRegion } = useCreationBlock()
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { promptEnhancedMode } = useEnhancedModePrompt()
  const [selected, setSelected] = useState<AccountOption | null>(defaultSelected)

  useEffect(() => {
    if (defaultSelected && !selected) setSelected(defaultSelected)
  }, [defaultSelected, selected])

  const handleContinue = () => {
    if (!selected) return

    if (isCreateMode) {
      /** Creation needs a region determination, which Anon refuses: offer the switch. */
      if (isAnonMode) {
        promptEnhancedMode()
        return
      }
      if (isCreationBlocked(selected)) {
        navigation.navigate("unsupportedRegion")
        return
      }
      if (selected === AccountOption.SelfCustodial) {
        navigation.navigate("selfCustodialChooseExperience", {
          onContinue: { route: ChooseExperienceContinueRoute.AcceptTerms },
        })
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

  const showSelfCustodial = options.includes(AccountOption.SelfCustodial)
  const showCustodial = options.includes(AccountOption.Custodial)
  const isContinueDisabled =
    !selected || detectingCountry || (isCreateMode && detectingRegion)

  const cardOptions: OptionCard<AccountOption>[] = []
  if (showCustodial) {
    cardOptions.push({
      key: AccountOption.Custodial,
      icon: "cloud",
      title: LL.AccountTypeSelectionScreen.custodialLabel(),
      description: LL.AccountTypeSelectionScreen.custodialDescription(),
      testID: "custodial-option",
    })
  }
  if (showSelfCustodial) {
    cardOptions.push({
      key: AccountOption.SelfCustodial,
      icon: "key-outline",
      title: LL.AccountTypeSelectionScreen.selfCustodialLabel(),
      description: LL.AccountTypeSelectionScreen.selfCustodialDescription(),
      testID: "self-custodial-option",
    })
  }

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

          {detectingCountry ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <OptionCardGroup
              options={cardOptions}
              selectedKey={selected}
              onSelect={setSelected}
            />
          )}
        </View>

        <View style={styles.ctaContainer}>
          <GaloyPrimaryButton
            title={
              selected
                ? LL.AccountTypeSelectionScreen.continueButton()
                : LL.AccountTypeSelectionScreen.chooseMethod()
            }
            onPress={handleContinue}
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
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
