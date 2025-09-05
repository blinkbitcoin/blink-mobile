import React, { useRef, useState, useCallback } from "react"
import { ActivityIndicator, Button, View } from "react-native"
import { LocalizedString } from "typesafe-i18n"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { useAccountLimitsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useAppConfig, usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DisplayCurrency, toUsdMoneyAmount } from "@app/types/amounts"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

const useStyles = makeStyles(({ colors }) => ({
  limitWrapper: {
    padding: 20,
    backgroundColor: colors.white,
  },
  increaseLimitsButtonContainer: {
    marginVertical: 20,
    marginHorizontal: 20,
  },
  contentTextBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  valueFieldType: {
    fontWeight: "bold",
    fontSize: 15,
    paddingBottom: 8,
  },
  valueRemaining: {
    fontWeight: "bold",
    color: colors._green,
    maxWidth: "50%",
  },
  valueTotal: {
    fontWeight: "bold",
    color: colors.grey3,
    maxWidth: "50%",
  },
  divider: {
    marginVertical: 0,
    borderWidth: 1,
    borderColor: colors.grey4,
  },
  errorWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: "50%",
    marginBottom: "50%",
  },
  errorText: {
    color: colors.error,
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 20,
  },
  loadingWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: "50%",
    marginBottom: "50%",
  },
  increaseLimitsContainer: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 5,
    padding: 20,
  },
  increaseLimitsText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 15,
    textDecorationLine: "underline",
  },
}))

const accountLimitsPeriodInHrs = {
  DAILY: "24",
  WEEKLY: "168",
} as const

gql`
  query accountLimits {
    me {
      id
      defaultAccount {
        id
        limits {
          withdrawal {
            totalLimit
            remainingLimit
            interval
          }
          internalSend {
            totalLimit
            remainingLimit
            interval
          }
          convert {
            totalLimit
            remainingLimit
            interval
          }
        }
      }
    }
  }
`

export const TransactionLimitsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const { data, loading, error, refetch } = useAccountLimitsQuery({
    fetchPolicy: "no-cache",
    skip: !useIsAuthed(),
  })

  const { appConfig } = useAppConfig()
  const { name: bankName } = appConfig.galoyInstance
  const { currentLevel } = useLevel()

  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false)
  const reopenUpgradeModal = useRef(false)

  const closeUpgradeModal = () => setIsUpgradeModalVisible(false)
  const openUpgradeModal = () => setIsUpgradeModalVisible(true)

  useFocusEffect(
    useCallback(() => {
      if (reopenUpgradeModal.current) {
        openUpgradeModal()
        reopenUpgradeModal.current = false
      }
    }, []),
  )

  if (error) {
    return (
      <Screen>
        <View style={styles.errorWrapper}>
          <Text adjustsFontSizeToFit style={styles.errorText}>
            {LL.TransactionLimitsScreen.error()}
          </Text>
          <Button
            title="reload"
            disabled={loading}
            color={colors.error}
            onPress={() => refetch()}
          />
        </View>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator animating size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll">
      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.receive()}
        </Text>
        <View>
          <View style={styles.contentTextBox}>
            <Text adjustsFontSizeToFit style={styles.valueRemaining}>
              {LL.TransactionLimitsScreen.unlimited()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.withdraw()}
        </Text>
        {data?.me?.defaultAccount.limits?.withdrawal.map((data, index: number) => (
          <TransactionLimitsPeriod key={index} {...data} />
        ))}
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.internalSend({ bankName })}
        </Text>
        {data?.me?.defaultAccount.limits?.internalSend.map((data, index: number) => (
          <TransactionLimitsPeriod key={index} {...data} />
        ))}
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.stablesatTransfers()}
        </Text>
        {data?.me?.defaultAccount.limits?.convert.map((data, index: number) => (
          <TransactionLimitsPeriod key={index} {...data} />
        ))}
      </View>
      {currentLevel === AccountLevel.Zero && (
        <GaloyPrimaryButton
          title={LL.TransactionLimitsScreen.increaseLimits()}
          onPress={() => {
            openUpgradeModal()
          }}
          containerStyle={styles.increaseLimitsButtonContainer}
        />
      )}
      {currentLevel === AccountLevel.One && (
        <GaloyPrimaryButton
          title={LL.TransactionLimitsScreen.increaseLimits()}
          onPress={() => navigation.navigate("fullOnboardingFlow")}
          containerStyle={styles.increaseLimitsButtonContainer}
        />
      )}

      <TrialAccountLimitsModal
        isVisible={isUpgradeModalVisible}
        closeModal={closeUpgradeModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
      />
    </Screen>
  )
}

const TransactionLimitsPeriod = ({
  totalLimit,
  remainingLimit,
  interval,
}: {
  readonly totalLimit: number
  readonly remainingLimit?: number | null
  readonly interval?: number | null
}) => {
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const { LL } = useI18nContext()
  const styles = useStyles()

  if (!convertMoneyAmount) {
    return null
  }

  const usdTotalLimitMoneyAmount = convertMoneyAmount(
    toUsdMoneyAmount(totalLimit),
    DisplayCurrency,
  )

  const usdRemainingLimitMoneyAmount =
    typeof remainingLimit === "number"
      ? convertMoneyAmount(toUsdMoneyAmount(remainingLimit), DisplayCurrency)
      : null

  const remainingLimitText = usdRemainingLimitMoneyAmount
    ? `${formatMoneyAmount({
        moneyAmount: usdRemainingLimitMoneyAmount,
      })} ${LL.TransactionLimitsScreen.remaining().toLocaleLowerCase()}`
    : ""

  const getLimitDuration = (period: number): LocalizedString | null => {
    const interval = (period / (60 * 60)).toString()
    switch (interval) {
      case accountLimitsPeriodInHrs.DAILY:
        return LL.TransactionLimitsScreen.perDay()
      case accountLimitsPeriodInHrs.WEEKLY:
        return LL.TransactionLimitsScreen.perWeek()
      default:
        return null
    }
  }

  const totalLimitText = `${formatMoneyAmount({
    moneyAmount: usdTotalLimitMoneyAmount,
  })} ${interval && getLimitDuration(interval)}`

  return (
    <View>
      <View style={styles.contentTextBox}>
        <Text adjustsFontSizeToFit style={styles.valueRemaining}>
          {remainingLimitText}
        </Text>
        <Text adjustsFontSizeToFit style={styles.valueTotal}>
          {totalLimitText}
        </Text>
      </View>
    </View>
  )
}
