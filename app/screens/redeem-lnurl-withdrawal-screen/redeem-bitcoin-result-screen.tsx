import React, { useEffect, useMemo } from "react"
import { ActivityIndicator, View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { withMyLnUpdateSub } from "../receive-bitcoin-screen/my-ln-updates-sub"

import { useLnurlWithdrawRedemption } from "./hooks"

type Prop = {
  route: RouteProp<RootStackParamList, "redeemBitcoinResult">
}

const RedeemBitcoinResultScreen: React.FC<Prop> = ({ route }) => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "redeemBitcoinResult">>()

  const {
    callback,
    domain,
    defaultDescription,
    k1,
    minWithdrawableSatoshis,
    maxWithdrawableSatoshis,
    receivingWalletDescriptor,
    unitOfAccountAmount,
    settlementAmount,
    displayAmount,
  } = route.params

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { formatDisplayAndWalletAmount } = useDisplayCurrency()
  const { LL } = useI18nContext()

  const { paid, pending, errorMessage, lnServiceErrorReason } =
    useLnurlWithdrawRedemption({
      walletId: receivingWalletDescriptor?.id,
      amountSats: settlementAmount.amount,
      callback,
      k1,
      defaultDescription,
      minWithdrawableSatoshis: minWithdrawableSatoshis.amount,
      maxWithdrawableSatoshis: maxWithdrawableSatoshis.amount,
    })

  useEffect(() => {
    // TODO: when USD is accepted:
    // if (receivingWalletDescriptor?.currency === WalletCurrency.Usd) {
    //   navigation.setOptions({ title: LL.RedeemBitcoinScreen.usdTitle() })
    // }
    navigation.setOptions({ title: LL.RedeemBitcoinScreen.title() })
  }, [navigation, LL])

  const renderSuccessView = useMemo(() => {
    if (!paid) return null
    return (
      <View style={styles.container}>
        <View {...testProps("Success Icon")} style={styles.container}>
          <GaloyIcon name={"payment-success"} size={128} />
        </View>
      </View>
    )
  }, [paid, styles])

  const renderErrorView = useMemo(() => {
    if (errorMessage === "") return null
    return (
      <View style={styles.container}>
        {lnServiceErrorReason ? (
          <Text style={styles.errorText} selectable>
            {lnServiceErrorReason}
          </Text>
        ) : null}
        <Text style={styles.errorText} selectable>
          {errorMessage}
        </Text>
      </View>
    )
  }, [errorMessage, lnServiceErrorReason, styles])

  const renderPendingView = useMemo(() => {
    if (!pending) return null
    return (
      <View style={styles.container}>
        <Text style={styles.pendingText} selectable>
          {LL.RedeemBitcoinScreen.paymentPending()}
        </Text>
      </View>
    )
  }, [pending, styles, LL])

  const renderActivityStatusView = useMemo(() => {
    if (errorMessage !== "" || paid || pending) return null
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }, [errorMessage, paid, pending, styles, colors.primary])

  return (
    <Screen preset="scroll" style={styles.contentContainer}>
      <View style={[styles.inputForm, styles.container]}>
        {defaultDescription && (
          <Text type={"p1"} style={styles.withdrawableDescriptionText}>
            {defaultDescription}
          </Text>
        )}
        <View style={styles.currencyInputContainer}>
          <Text>
            {LL.RedeemBitcoinScreen.redeemAmountFrom({
              amountToRedeem: formatDisplayAndWalletAmount({
                primaryAmount: unitOfAccountAmount,
                walletAmount: settlementAmount,
                displayAmount,
              }),
              domain,
            })}
          </Text>
        </View>

        <View style={styles.qr}>
          {renderSuccessView}
          {renderErrorView}
          {renderPendingView}
          {renderActivityStatusView}
        </View>
      </View>
    </Screen>
  )
}

export default withMyLnUpdateSub(RedeemBitcoinResultScreen)

const useStyles = makeStyles(({ colors }) => ({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    marginLeft: 20,
    marginRight: 20,
  },
  inputForm: {
    marginVertical: 20,
  },
  currencyInputContainer: {
    padding: 10,
    marginTop: 10,
    backgroundColor: colors.grey5,
    borderRadius: 10,
  },
  withdrawableDescriptionText: {
    textAlign: "center",
  },
  qr: {
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  pendingText: {
    color: colors.warning,
    textAlign: "center",
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
  },
}))
