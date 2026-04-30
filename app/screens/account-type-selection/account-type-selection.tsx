import React, { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { AccountOption, useAccountTypeOptions } from "@app/hooks/use-account-type-options"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen"
import { testProps } from "@app/utils/testProps"

const SelectionMode = {
  Create: "create",
  Restore: "restore",
} as const

export const AccountTypeSelectionScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "accountTypeSelection">>()
  const { mode } = route.params
  const {
    options,
    defaultSelected,
    selfCustodialTemporarilyDisabled,
    loading: detectingCountry,
  } = useAccountTypeOptions()
  const [selected, setSelected] = useState<AccountOption | null>(defaultSelected)

  // Pre-select the only available option once detection finishes.
  useEffect(() => {
    if (defaultSelected && !selected) setSelected(defaultSelected)
  }, [defaultSelected, selected])

  const handleContinue = () => {
    if (!selected) return

    if (selected === AccountOption.Custodial) {
      if (mode === SelectionMode.Create) {
        navigation.navigate("acceptTermsAndConditions", { flow: "trial" })
        return
      }
      navigation.navigate("login", {
        type: PhoneLoginInitiateType.Login,
      })
      return
    }

    if (mode === SelectionMode.Create) {
      navigation.navigate("acceptTermsAndConditions", {
        flow: "selfCustodial",
      })
      return
    }

    navigation.navigate("sparkRestoreMethodScreen")
  }

  const isSelected = (option: AccountOption) => selected === option
  const showSelfCustodial = options.includes(AccountOption.SelfCustodial)
  const showCustodial = options.includes(AccountOption.Custodial)

  return (
    <Screen>
      <View style={styles.wrapper}>
        <View style={styles.body}>
          <Text style={styles.description}>
            {mode === SelectionMode.Create
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
            <View style={styles.grid}>
              {showCustodial && (
                <Pressable
                  style={[
                    styles.card,
                    isSelected(AccountOption.Custodial) && {
                      borderColor: colors.primary,
                      backgroundColor: colors.grey6,
                    },
                  ]}
                  onPress={() => setSelected(AccountOption.Custodial)}
                  {...testProps("custodial-option")}
                >
                  <View style={styles.iconContainer}>
                    <GaloyIcon name="cloud" size={20} />
                  </View>
                  <Text style={styles.cardTitle}>
                    {LL.AccountTypeSelectionScreen.custodialLabel()}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {LL.AccountTypeSelectionScreen.custodialDescription()}
                  </Text>
                </Pressable>
              )}

              {showSelfCustodial && (
                <Pressable
                  style={[
                    styles.card,
                    isSelected(AccountOption.SelfCustodial) && {
                      borderColor: colors.primary,
                      backgroundColor: colors.grey6,
                    },
                  ]}
                  onPress={() => setSelected(AccountOption.SelfCustodial)}
                  {...testProps("self-custodial-option")}
                >
                  <View style={styles.iconContainer}>
                    <GaloyIcon name="key-outline" size={20} />
                  </View>
                  <Text style={styles.cardTitle}>
                    {LL.AccountTypeSelectionScreen.selfCustodialLabel()}
                  </Text>
                  <Text style={styles.cardDescription}>
                    {LL.AccountTypeSelectionScreen.selfCustodialDescription()}
                  </Text>
                </Pressable>
              )}
            </View>
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
            disabled={!selected || detectingCountry}
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
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    maxWidth: "50%",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 30,
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.grey2,
    textAlign: "center",
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
