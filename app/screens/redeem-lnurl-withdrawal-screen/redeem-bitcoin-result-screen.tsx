import fetch from "cross-fetch"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useApolloClient } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import {
  HomeAuthedDocument,
  useLnInvoiceCreateMutation,
  WalletCurrency,
} from "@app/graphql/generated"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { withMyLnUpdateSub } from "../receive-bitcoin-screen/my-ln-updates-sub"
import { LnInvoiceNoSecret } from "../receive-bitcoin-screen/payment/index.types"

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

  const client = useApolloClient()
  const { LL } = useI18nContext()
  const lastHash = useLnUpdateHashPaid()

  useEffect(() => {
    // TODO: when USD is accepted:
    // if (receivingWalletDescriptor.currency === WalletCurrency.Usd) {
    //   navigation.setOptions({ title: LL.RedeemBitcoinScreen.usdTitle() })
    // }

    if (receivingWalletDescriptor.currency === WalletCurrency.Btc) {
      navigation.setOptions({ title: LL.RedeemBitcoinScreen.title() })
    }
  }, [receivingWalletDescriptor.currency, navigation, LL])

  const [err, setErr] = useState("")
  const [lnServiceErrorReason, setLnServiceErrorReason] = useState("")
  const [withdrawalInvoice, setInvoice] = useState<LnInvoiceNoSecret | null>(null)

  const [memo] = useState(defaultDescription)

  // FIXME: this would be false again if multiple invoice happen to be paid
  // when the user stays on this screen
  const invoicePaid = withdrawalInvoice?.paymentHash === lastHash
  const [lnInvoiceCreate] = useLnInvoiceCreateMutation()

  const createWithdrawRequestInvoice = useCallback(
    async (satAmount: number, memo: string) => {
      setInvoice(null)
      try {
        // logGeneratePaymentRequest({
        //   paymentType: PaymentRequest.Lightning,
        //   hasAmount: true,
        //   receivingWallet: WalletCurrency.Btc,
        // })
        const { data } = await lnInvoiceCreate({
          variables: {
            input: { walletId: receivingWalletDescriptor.id, amount: satAmount, memo },
          },
        })

        if (!data) {
          throw new Error("No data returned from lnInvoiceCreate")
        }

        const {
          lnInvoiceCreate: { invoice, errors },
        } = data

        if (errors && errors.length !== 0) {
          console.error(errors, "error with lnInvoiceCreate")
          setErr(LL.RedeemBitcoinScreen.error())
          return
        }

        invoice && setInvoice(invoice)
      } catch (err) {
        console.error(err, "error with AddInvoice")
        setErr(`${err}`)
        throw err
      }
    },
    [lnInvoiceCreate, receivingWalletDescriptor, LL],
  )

  const submitLNURLWithdrawRequest = useCallback(
    async (generatedInvoice: LnInvoiceNoSecret) => {
      const urlObject = new URL(callback)
      const searchParams = urlObject.searchParams
      searchParams.set("k1", k1)
      searchParams.set("pr", generatedInvoice.paymentRequest)

      const url = urlObject.toString()

      const result = await fetch(url)

      if (result.ok) {
        const lnurlResponse = await result.json()
        if (lnurlResponse?.status?.toLowerCase() !== "ok") {
          console.error(lnurlResponse, "error with redeeming")
          setErr(LL.RedeemBitcoinScreen.redeemingError())
          if (lnurlResponse?.reason) {
            setLnServiceErrorReason(lnurlResponse.reason)
          }
        }
      } else {
        console.error(result.text(), "error with submitting withdrawalRequest")
        setErr(LL.RedeemBitcoinScreen.submissionError())
      }
    },
    [callback, LL, k1],
  )

  useEffect((): void | (() => void) => {
    if (withdrawalInvoice) {
      submitLNURLWithdrawRequest(withdrawalInvoice)
    } else {
      createWithdrawRequestInvoice(settlementAmount.amount, memo)
    }
  }, [
    withdrawalInvoice,
    memo,
    settlementAmount,
    createWithdrawRequestInvoice,
    submitLNURLWithdrawRequest,
  ])

  const renderSuccessView = useMemo(() => {
    if (invoicePaid) {
      client.refetchQueries({ include: [HomeAuthedDocument] })

      return (
        <View style={styles.container}>
          <View {...testProps("Success Icon")} style={styles.container}>
            <GaloyIcon name={"payment-success"} size={128} />
          </View>
        </View>
      )
    }
    return null
  }, [invoicePaid, styles, client])

  const renderErrorView = useMemo(() => {
    if (err !== "") {
      return (
        <View style={styles.container}>
          {lnServiceErrorReason && (
            <Text style={styles.errorText} selectable>
              {lnServiceErrorReason}
            </Text>
          )}
          <Text style={styles.errorText} selectable>
            {err}
          </Text>
        </View>
      )
    }

    return null
  }, [err, lnServiceErrorReason, styles])

  const renderActivityStatusView = useMemo(() => {
    if (err === "" && !invoicePaid) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }
    return null
  }, [err, invoicePaid, styles, colors.primary])

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
  contentContainer: {
    padding: 20,
    flexGrow: 1,
  },
}))
