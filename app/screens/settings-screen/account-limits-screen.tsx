import React from "react"
import { ActivityIndicator, Button, View } from "react-native"
import { Text } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import { ScrollView } from "react-native-gesture-handler"

import { Screen } from "@app/components/screen"
import { useAccountLimitsQuery } from "@app/hooks/use-account-limits"
import { palette } from "@app/theme"
import { WalletCurrency } from "@app/types/amounts"
import { usdAmountDisplay } from "@app/utils/currencyConversion"
import { useI18nContext } from "@app/i18n/i18n-react"

const styles = EStyleSheet.create({
  container: {
    marginTop: 10,
  },
  limitWrapper: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  content: {
    backgroundColor: palette.white,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  contentTextBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  valueFieldType: {
    fontWeight: "bold",
    fontSize: "15rem",
    paddingBottom: 8,
  },
  valueRemaining: {
    fontWeight: "bold",
    color: palette.green,
  },
  valueTotal: {
    fontWeight: "bold",
    color: palette.midGrey,
  },
  divider: {
    marginVertical: 0,
    borderWidth: 1,
    borderColor: palette.inputBackground,
  },
  errorWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: "50%",
    marginBottom: "50%",
  },
  errorText: {
    color: palette.error,
    fontWeight: "bold",
    fontSize: "18rem",
    marginBottom: 20,
  },
  loadingWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: "50%",
    marginBottom: "50%",
  },
})

export const TransactionTypeArray = ["BTC", "USD"] as const

export const AccountLimitsScreen = () => {
  const { LL } = useI18nContext()
  const { withdrawalLimits, internalSendLimits, convertLimits, loading, error, refetch } =
    useAccountLimitsQuery()

  if (error) {
    return (
      <Screen>
        <View style={styles.errorWrapper}>
          <Text adjustsFontSizeToFit style={styles.errorText}>
            {LL.AccountLimitsScreen.error()}
          </Text>
          <Button
            title="reload"
            disabled={loading}
            color={palette.error}
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
          <ActivityIndicator animating size="large" color={palette.lightBlue} />
        </View>
      </Screen>
    )
  }

  return (
    <ScrollView>
      <Screen>
        <View style={styles.limitWrapper}>
          {TransactionTypeArray.map((txType, index: number) => {
            return (
              <View style={styles.container} key={index}>
                <Text style={styles.header}>
                  {txType === WalletCurrency.BTC
                    ? LL.AccountLimitsScreen.bitcoinTransactions()
                    : LL.AccountLimitsScreen.USDTransactions()}
                </Text>
                <View style={styles.content}>
                  <Text adjustsFontSizeToFit style={styles.valueFieldType}>
                    {LL.AccountLimitsScreen.receive()}
                  </Text>
                  <View style={styles.contentTextBox}>
                    <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                      {LL.AccountLimitsScreen.unlimited()}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.content}>
                  <Text adjustsFontSizeToFit style={styles.valueFieldType}>
                    {LL.AccountLimitsScreen.withdraw()}
                  </Text>
                  <View style={styles.contentTextBox}>
                    <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                      {`${usdAmountDisplay(
                        Number(withdrawalLimits?.DailyAccountLimit.remainingLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                    </Text>
                    <Text adjustsFontSizeToFit style={styles.valueTotal}>
                      {`${usdAmountDisplay(
                        Number(withdrawalLimits?.DailyAccountLimit.totalLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.perDay()}`}
                    </Text>
                  </View>
                  <View style={styles.contentTextBox}>
                    <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                      {`${usdAmountDisplay(
                        Number(withdrawalLimits?.WeeklyAccountLimit.remainingLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                    </Text>
                    <Text adjustsFontSizeToFit style={styles.valueTotal}>
                      {`${usdAmountDisplay(
                        Number(withdrawalLimits?.WeeklyAccountLimit.totalLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.perWeek()}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.content}>
                  <Text adjustsFontSizeToFit style={styles.valueFieldType}>
                    {LL.AccountLimitsScreen.internalSend()}
                  </Text>
                  <View style={styles.contentTextBox}>
                    <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                      {`${usdAmountDisplay(
                        Number(internalSendLimits?.DailyAccountLimit.remainingLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                    </Text>
                    <Text adjustsFontSizeToFit style={styles.valueTotal}>
                      {`${usdAmountDisplay(
                        Number(internalSendLimits?.DailyAccountLimit.totalLimit),
                        0,
                      )} per day`}
                    </Text>
                  </View>
                  <View style={styles.contentTextBox}>
                    <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                      {`${usdAmountDisplay(
                        Number(internalSendLimits?.WeeklyAccountLimit.remainingLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                    </Text>
                    <Text adjustsFontSizeToFit style={styles.valueTotal}>
                      {`${usdAmountDisplay(
                        Number(internalSendLimits?.WeeklyAccountLimit.totalLimit),
                        0,
                      )} ${LL.AccountLimitsScreen.perWeek()}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                {txType === WalletCurrency.USD ? (
                  <View style={styles.content}>
                    <Text adjustsFontSizeToFit style={styles.valueFieldType}>
                      {LL.AccountLimitsScreen.convertToStablesat()}
                    </Text>
                    <View style={styles.contentTextBox}>
                      <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                        {`${usdAmountDisplay(
                          Number(convertLimits?.DailyAccountLimit.remainingLimit),
                          0,
                        )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                      </Text>
                      <Text adjustsFontSizeToFit style={styles.valueTotal}>
                        {`${usdAmountDisplay(
                          Number(convertLimits?.DailyAccountLimit.totalLimit),
                          0,
                        )} ${LL.AccountLimitsScreen.perDay()}`}
                      </Text>
                    </View>
                    <View style={styles.contentTextBox}>
                      <Text adjustsFontSizeToFit style={styles.valueRemaining}>
                        {`${usdAmountDisplay(
                          Number(convertLimits?.WeeklyAccountLimit.remainingLimit),
                          0,
                        )} ${LL.AccountLimitsScreen.remaining().toLocaleLowerCase()}`}
                      </Text>
                      <Text adjustsFontSizeToFit style={styles.valueTotal}>
                        {`${usdAmountDisplay(
                          Number(convertLimits?.WeeklyAccountLimit.totalLimit),
                          0,
                        )} ${LL.AccountLimitsScreen.perWeek()}`}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      </Screen>
    </ScrollView>
  )
}
