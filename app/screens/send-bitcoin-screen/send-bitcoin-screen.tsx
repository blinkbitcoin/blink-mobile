/* eslint-disable react-native/no-inline-styles */
import { gql, useApolloClient, useLazyQuery } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp } from "@react-navigation/native"
import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, Text, View } from "react-native"
import { Button, Icon } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
// import Icon from "react-native-vector-icons/Ionicons"
import debounce from "lodash.debounce"
import { getParams, LNURLPayParams } from "js-lnurl"

import { InputPayment } from "../../components/input-payment"
import { GaloyInput } from "../../components/galoy-input"
import { Screen } from "../../components/screen"
import { useMoneyAmount, useWalletBalance } from "../../hooks"
import { translate } from "../../i18n"
import type { MoveMoneyStackParamList } from "../../navigation/stack-param-lists"
import { color } from "../../theme"
import { palette } from "../../theme/palette"
import type { ScreenType } from "../../types/jsx"
import { IPaymentType, validPayment } from "../../utils/parsing"
import useToken from "../../utils/use-token"
import * as UsernameValidation from "../../utils/validation"
import { TextCurrency } from "../../components/text-currency/text-currency"
import { useMyCurrencies, useMySubscription } from "../../hooks/user-hooks"
import { toastShow } from "../../utils/toast"
import useMainQuery from "@app/hooks/use-main-query"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

export const PRICE_CHECK_INTERVAL = 10000

const USER_WALLET_ID = gql`
  query userDefaultWalletId($username: Username!) {
    userDefaultWalletId(username: $username)
  }
`

type SendBitcoinScreenProps = {
  navigation: StackNavigationProp<MoveMoneyStackParamList, "sendBitcoin">
  route: RouteProp<MoveMoneyStackParamList, "sendBitcoin">
}

type LnurlParams = {
  lnurl: string
  minSendable: number
  maxSendable: number
  domain: string
  callback: string
  commentAllowed: number
  error: string
}

export const SendBitcoinScreen: ScreenType = ({
  navigation,
  route,
}: SendBitcoinScreenProps) => {
  const client = useApolloClient()
  const { tokenNetwork } = useToken()

  const { formatCurrencyAmount } = useMySubscription()
  const { satBalance } = useWalletBalance()
  const { primaryCurrency, secondaryCurrency, toggleCurrency } = useMyCurrencies()
  const [primaryAmount, convertPrimaryAmount, setPrimaryAmount, setPrimaryAmountValue] =
    useMoneyAmount(primaryCurrency)
  const [
    secondaryAmount,
    convertSecondaryAmount,
    setSecondaryAmount,
    setSecondaryAmountValue,
  ] = useMoneyAmount(secondaryCurrency)
  const { myPubKey, username: myUsername } = useMainQuery()
  const [invoiceError, setInvoiceError] = useState("")
  const [address, setAddress] = useState("")
  const [lnurlPay, setLnurlPay] = useState<LnurlParams>({
    lnurl: "",
    minSendable: 0,
    maxSendable: 0,
    domain: "",
    callback: "",
    commentAllowed: 0,
    error: "",
  })
  const [lnurlError, setLnurlError] = useState("")

  const [paymentType, setPaymentType] = useState<IPaymentType>(undefined)
  const [amountless, setAmountless] = useState(false)
  const [destination, setDestinationInternal] = useState("")
  const [destinationStatus, setDestinationStatus] = useState<
    "VALID" | "INVALID" | "NOT_CHECKED"
  >("NOT_CHECKED")
  const [invoice, setInvoice] = useState("")
  const [memo, setMemo] = useState<string>("")
  const [sameNode, setSameNode] = useState<boolean | null>(null)
  const [interactive, setInteractive] = useState(false)
  const [isSendLockEnabled, setIsSendLockEnabled] = useState(false)
  const [isStaticLnurlIdentifier, setIsStaticLnurlIdentifier] = useState(false)

  const satAmount =
    primaryCurrency === "BTC" ? primaryAmount.value : secondaryAmount.value

  const referenceAmount: MoneyAmount = useMemo(() => {
    if ((paymentType === "onchain" || paymentType === "lightning") && !amountless) {
      return {
        value: satAmount,
        currency: "BTC",
      }
    }
    return primaryAmount
  }, [amountless, paymentType, primaryAmount, satAmount])

  const [
    userDefaultWalletIdQuery,
    { loading: loadingUserDefaultWalletId, data: dataUserDefaultWalletId },
  ] = useLazyQuery(USER_WALLET_ID, {
    fetchPolicy: "network-only",
    onCompleted: (dataUserDefaultWalletId) => {
      if (dataUserDefaultWalletId?.userDefaultWalletId) {
        setDestinationStatus("VALID")
      }
    },
    onError: () => {
      setDestinationStatus("INVALID")
    },
  })

  const setDestination = (input) => {
    setDestinationInternal(input.trim())
  }

  const getIsSendLockEnabled = async () => {
    setIsSendLockEnabled(await KeyStoreWrapper.getIsSendLockEnabled())
  }

  useEffect(() => {
    if (lnurlPay.lnurl !== "" && lnurlPay.minSendable > 0 && lnurlPay.minSendable == lnurlPay.maxSendable) {
      if (primaryAmount.currency === "USD") {
        toggleCurrency()
      }

      setTimeout(() => {
        setPrimaryAmountValue(lnurlPay.minSendable)
      }, 100)
    }
  }, [lnurlPay])

  const reset = useCallback(() => {
    setInvoiceError("")
    setAddress("")
    setPaymentType(undefined)
    setAmountless(false)
    setPrimaryAmountValue(0)
    setDestination("")
    setInvoice("")
    setMemo("")
    setInteractive(true)
  }, [setPrimaryAmountValue])

  useEffect(() => {
    if (primaryCurrency !== primaryAmount.currency) {
      const tempAmount = { ...secondaryAmount }
      setSecondaryAmount(primaryAmount)
      setPrimaryAmount(tempAmount)
    }
  }, [
    primaryCurrency,
    primaryAmount,
    secondaryAmount,
    setPrimaryAmount,
    setSecondaryAmount,
  ])

  useEffect(() => {
    reset()
    const { valid, username } = validPayment(
      route.params?.payment,
      tokenNetwork,
      myPubKey,
      myUsername,
    )
    if (route.params?.username || username) {
      setInteractive(false)
      setDestination(route.params?.username || username)
    } else if (valid) {
      setInteractive(false)
      setDestination(route.params?.payment)
    } else {
      setInteractive(true)
    }

    getIsSendLockEnabled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, tokenNetwork, route.params])

  useEffect(() => {
    if ((paymentType !== "onchain" && paymentType !== "lightning") || amountless) {
      convertSecondaryAmount(primaryAmount)
    }
  }, [amountless, convertSecondaryAmount, paymentType, primaryAmount])

  useEffect(() => {
    // Update the USD amount (which could be primary or secondary) based on a new price from the API
    if (
      (paymentType === "onchain" || paymentType === "lightning") &&
      !amountless &&
      satAmount !== 0
    ) {
      if (primaryAmount.currency === "BTC") {
        setPrimaryAmountValue(satAmount)
        convertSecondaryAmount({
          value: satAmount,
          currency: "BTC",
        })
      } else {
        convertPrimaryAmount({
          value: satAmount,
          currency: "BTC",
        })
      }
    }
  }, [
    amountless,
    convertPrimaryAmount,
    convertSecondaryAmount,
    paymentType,
    primaryAmount.currency,
    satAmount,
    setPrimaryAmountValue,
  ])

  const userDefaultWalletIdQueryDebounced = useCallback(
    debounce(async (destination) => {
      userDefaultWalletIdQuery({ variables: { username: destination } })
    }, 1500),
    [],
  )

  const debouncedGetLnurlParams = useMemo(
    () =>
      debounce(async (lnurl) => {
        getParams(lnurl)
          .then((params) => {
            if ("reason" in params) {
              throw params.reason
            }
            if (params.tag === "payRequest") {
              const lnurlparams = setLnurlParams({
                params: params as LNURLPayParams,
                lnurl,
              })
              setDestinationStatus("VALID")
              setLnurlPay({ ...lnurlparams })
            }
          })
          .catch((err) => {
            setDestinationStatus("INVALID")
            toastShow(err.toString())
            // Alert.alert(err.toString())
          })
      }, 1500),
    [],
  )

  const setLnurlParams = ({ params, lnurl }): LnurlParams => {
    return {
      lnurl: lnurl,
      minSendable: params.minSendable / 1000,
      maxSendable: params.maxSendable / 1000,
      domain: params.domain,
      callback: params.callback,
      commentAllowed: params.commentAllowed,
      error: "",
    }
  }

  useEffect(() => {
    const {
      valid,
      errorMessage,
      invoice,
      amount: amountInvoice,
      amountless,
      memo: memoInvoice,
      paymentType,
      address,
      lnurl,
      sameNode,
      staticLnurlIdentifier,
    } = validPayment(destination, tokenNetwork, myPubKey, myUsername)

    if (valid) {
      setAddress(address)
      setPaymentType(paymentType)
      setInvoice(invoice)

      if (lnurl) {
        setPaymentType("lnurl")
        if (staticLnurlIdentifier) {
          setIsStaticLnurlIdentifier(true)
          setInteractive(true)
        }
        if (route.params?.lnurlParams) {
          const params = setLnurlParams({ params: route.params.lnurlParams, lnurl })
          setLnurlPay({ ...params })
        } else {
          debouncedGetLnurlParams(lnurl)
        }
      }
      setAmountless(amountless)
      if (!amountless && !staticLnurlIdentifier) {
        const moneyAmount: MoneyAmount = { value: amountInvoice, currency: "BTC" }
        if (primaryCurrency === "BTC") {
          setPrimaryAmountValue(amountInvoice)
        } else {
          convertPrimaryAmount(moneyAmount)
          setSecondaryAmountValue(amountInvoice)
        }
      }

      if (!memo && memoInvoice) {
        setMemo(memoInvoice.toString())
      }
      setSameNode(sameNode)
    } else if (errorMessage) {
      setPaymentType(paymentType)
      setInvoiceError(errorMessage)
      setInvoice(destination)
    } else {
      setPaymentType("username")

      if (UsernameValidation.isValid(destination)) {
        userDefaultWalletIdQueryDebounced(destination)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination])

  const errorMessage = useMemo(() => {
    if (invoiceError) {
      return invoiceError
    } else if (!!satAmount && satBalance && satAmount > satBalance) {
      return translate("SendBitcoinScreen.amountExceed", {
        balance: formatCurrencyAmount({ sats: satBalance, currency: primaryCurrency }),
      })
    } else if (isSendLockEnabled) {
      return translate("SendBitcoinScreen.sendLockEnabled")
    }
    return null
  }, [
    formatCurrencyAmount,
    invoiceError,
    primaryCurrency,
    satAmount,
    satBalance,
    isSendLockEnabled,
  ])

  useEffect(() => {
    setDestinationStatus("NOT_CHECKED")
  }, [destination])

  const fetchInvoice = async (url) => {
    try {
      const response = await fetch(url.replace('/&', '&'))
      if (!response.ok) {
        return {
          status: "ERROR",
          reason: translate("errors.network.server"),
        }
      }
      return await response.json()
    } catch (err) {
      return {
        status: "ERROR",
        reason: translate("errors.network.server"),
      }
    }
  }

  const pay = useCallback(async () => {
    if (paymentType === "username" && destinationStatus !== "VALID") {
      userDefaultWalletIdQuery({ variables: { username: destination } })
      toastShow(translate("SendBitcoinScreen.usernameNotFound"))
      return
    } else if (paymentType == "lnurl") {
      let satAmount = 0

      if (primaryCurrency === "BTC") {
        satAmount = primaryAmount.value * 1000
      } else {
        satAmount = Math.round(secondaryAmount.value) * 1000
      }

      const url = new URL(lnurlPay.callback)
      url.searchParams.append('amount', satAmount.toString())
      url.searchParams.append('comment', memo)
      const lnurlInvoice = await fetchInvoice(url.toString())

      if (lnurlInvoice.status && lnurlInvoice.status === "ERROR") {
        setLnurlError(lnurlInvoice.reason)
      } else {
        navigation.navigate("sendBitcoinConfirmation", {
          address,
          amountless,
          invoice: lnurlInvoice.pr,
          lnurlSuccessAction: lnurlInvoice.successAction,
          memo,
          paymentType,
          primaryCurrency,
          referenceAmount,
          sameNode,
          username: null,
          recipientDefaultWalletId: null,
        })
      }
    } else {
      navigation.navigate("sendBitcoinConfirmation", {
        address,
        amountless,
        invoice,
        memo,
        paymentType,
        primaryCurrency,
        referenceAmount,
        sameNode,
        username: paymentType === "username" ? destination : null,
        recipientDefaultWalletId:
          paymentType === "username" ? dataUserDefaultWalletId.userDefaultWalletId : null,
      })
    }
  }, [
    paymentType,
    destinationStatus,
    userDefaultWalletIdQuery,
    destination,
    navigation,
    address,
    amountless,
    invoice,
    lnurlPay,
    primaryAmount,
    secondaryAmount,
    memo,
    primaryCurrency,
    referenceAmount,
    sameNode,
    dataUserDefaultWalletId,
  ])

  return (
    <SendBitcoinScreenJSX
      paymentType={paymentType}
      amountless={amountless}
      setPrimaryAmountValue={setPrimaryAmountValue}
      invoice={invoice}
      address={address}
      lnurlPay={lnurlPay}
      lnurlError={lnurlError}
      setLnurlError={setLnurlError}
      memo={memo}
      pay={pay}
      primaryAmount={primaryAmount}
      secondaryAmount={secondaryAmount}
      navigation={navigation}
      toggleCurrency={toggleCurrency}
      setMemo={setMemo}
      setDestination={setDestination}
      destination={destination}
      destinationStatus={destinationStatus}
      loadingUserNameExist={loadingUserDefaultWalletId}
      interactive={interactive}
      errorMessage={errorMessage}
      reset={reset}
      isStaticLnurlIdentifier={isStaticLnurlIdentifier}
    />
  )
}

type SendBitcoinScreenJSXProps = {
  paymentType: string
  amountless: boolean
  setPrimaryAmountValue: (value: number) => void
  invoice: string
  address: string
  lnurlPay: LnurlParams
  lnurlError: string
  setLnurlError: (error: string) => void
  memo: string
  amount: number
  navigation: StackNavigationProp<MoveMoneyStackParamList, "sendBitcoin">
  toggleCurrency: () => void
  pay: () => void
  primaryAmount: MoneyAmount
  secondaryAmount: MoneyAmount
  setMemo: (memo: string) => void
  setDestination: (destination: string) => void
  destination: string
  destinationStatus: string
  loadingUserNameExist: boolean
  interactive: boolean
  errorMessage: string
  reset: () => void
  isStaticLnurlIdentifier: boolean
}

export const SendBitcoinScreenJSX: ScreenType = ({
  paymentType,
  amountless,
  setPrimaryAmountValue,
  invoice,
  address,
  lnurlPay,
  lnurlError,
  setLnurlError,
  memo,
  navigation,
  toggleCurrency,
  pay,
  primaryAmount,
  secondaryAmount,
  setMemo,
  setDestination,
  destination,
  destinationStatus,
  loadingUserNameExist,
  interactive,
  errorMessage,
  reset,
  isStaticLnurlIdentifier,
}: SendBitcoinScreenJSXProps) => {
  const destinationInputRightIcon = () => {
    if (
      (UsernameValidation.hasValidLength(destination) && paymentType === "username") ||
      isStaticLnurlIdentifier
    ) {
      if (
        loadingUserNameExist ||
        (UsernameValidation.isValid(destination) &&
          destinationStatus === "NOT_CHECKED") || // The debounce delay
        (isStaticLnurlIdentifier && destinationStatus === "NOT_CHECKED")
      ) {
        return <ActivityIndicator size="small" />
      } else if (
        (UsernameValidation.isValid(destination) && destinationStatus === "VALID") ||
        (isStaticLnurlIdentifier && destinationStatus === "VALID")
      ) {
        return <Text>✅</Text>
      } else if (
        !UsernameValidation.isValid(destination) ||
        destinationStatus === "INVALID" ||
        (isStaticLnurlIdentifier && destinationStatus === "INVALID")
      ) {
        return <Text>⚠️</Text>
      } else {
        return <Text></Text>
      }
    } else if (paymentType === "lightning" || paymentType === "onchain") {
      return <Icon name="remove-circle-outline" onPress={reset} size={30} />
    } else if (paymentType === "lnurl") {
      let lnurlErrorStr = ""
      if (
        primaryAmount &&
        primaryAmount.currency === "BTC" &&
        primaryAmount.value > lnurlPay.maxSendable
      ) {
        lnurlErrorStr = translate("lnurl.overLimit")
      } else if (
        primaryAmount &&
        primaryAmount.currency === "BTC" &&
        primaryAmount.value < lnurlPay.minSendable
      ) {
        lnurlErrorStr = translate("lnurl.underLimit")
      } else if (
        secondaryAmount &&
        secondaryAmount.currency === "BTC" &&
        secondaryAmount.value > lnurlPay.maxSendable
      ) {
        lnurlErrorStr = translate("lnurl.overLimit")
      } else if (
        secondaryAmount &&
        secondaryAmount.currency === "BTC" &&
        secondaryAmount.value < lnurlPay.minSendable
      ) {
        lnurlErrorStr = translate("lnurl.underLimit")
      } else if (lnurlPay.commentAllowed && memo === "") {
        lnurlErrorStr = translate("lnurl.commentRequired")
      } else {
        lnurlErrorStr = ""
      }
      setLnurlError(lnurlErrorStr)
    } else if (destination.length === 0) {
      return (
        <Icon
          name="camera"
          onPress={() => navigation.navigate("scanningQRCode")}
          size={30}
          style={styles.iconColor}
        />
      )
    }

    return null
  }

  return (
    <Screen preset="fixed">
      <ScrollView
        style={styles.mainView}
        contentContainerStyle={{ justifyContent: "space-between" }}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.section}>
          <InputPayment
            editable={(paymentType !== "lightning" && paymentType !== "onchain") || amountless}
            forceKeyboard={navigation?.isFocused() ?? false}
            toggleCurrency={toggleCurrency}
            onUpdateAmount={setPrimaryAmountValue}
            primaryAmount={primaryAmount}
            secondaryAmount={secondaryAmount}
          />
          <TextCurrency
            amount={secondaryAmount.value}
            currency={secondaryAmount.currency}
            style={styles.subCurrencyText}
          />
          {paymentType === "lnurl" && (
            <View style={styles.errorContainer}>
              <Text>
                Min: {lnurlPay.minSendable} sats - Max: {lnurlPay.maxSendable} sats
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <GaloyInput
            placeholder={translate("SendBitcoinScreen.input")}
            leftIcon={
              <View style={styles.row}>
                <Text style={styles.smallText}>{translate("common.to")}</Text>
                <Icon
                  name="logout"
                  size={24}
                  color={color.primary}
                  style={styles.icon}
                />
              </View>
            }
            onChangeText={setDestination}
            rightIcon={destinationInputRightIcon()}
            value={
              paymentType === "lightning"
                ? invoice
                : paymentType === "onchain"
                ? address
                : destination
            }
            editable={interactive}
            selectTextOnFocus
            autoCompleteType="username"
            autoCapitalize="none"
          />
          <GaloyInput
            placeholder={translate("SendBitcoinScreen.note")}
            leftIcon={
              <View style={styles.row}>
                <Text style={styles.smallText}>{translate("common.note")}</Text>
                <Icon
                  name="add-circle-outline"
                  size={24}
                  color={color.primary}
                  style={styles.icon}
                />
              </View>
            }
            value={memo}
            onChangeText={(value) => setMemo(value)}
            selectTextOnFocus
          />
          {paymentType === "lnurl" && (
            <View>
              <Text style={styles.domainText}>
                {translate("common.domain")}: {lnurlPay.domain}
              </Text>
            </View>
          )}
        </View>
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        <Button
          buttonStyle={styles.buttonStyle}
          containerStyle={{ flex: 1 }}
          title={
            !primaryAmount.value
              ? translate("common.amountRequired")
              : !destination
              ? translate("common.usernameRequired")
              : lnurlError
              ? lnurlError
              : translate("common.send")
          }
          onPress={pay}
          disabled={
            !primaryAmount.value ||
            !!errorMessage ||
            !destination ||
            !!lnurlError ||
            loadingUserNameExist ||
            (UsernameValidation.isValid(destination) &&
              destinationStatus === "NOT_CHECKED")
          }
        />
      </ScrollView>
    </Screen>
  )
}

const styles = EStyleSheet.create({
  buttonStyle: {
    backgroundColor: color.primary,
    marginBottom: "32rem",
    marginHorizontal: "24rem",
    marginTop: "32rem",
  },

  errorContainer: {
    alignItems: "center",
  },

  errorText: {
    color: color.error,
  },

  icon: {
    color: palette.darkGrey,
    marginRight: 15,
  },

  iconColor: {
    color: palette.darkGrey,
  },

  mainView: {
    flex: 1,
    paddingHorizontal: 20,
  },

  row: { flexDirection: "row" },

  section: {
    marginHorizontal: 16,
  },

  smallText: {
    color: palette.darkGrey,
    fontSize: 18,
    textAlign: "left",
    width: "48rem",
  },

  subCurrencyText: {
    color: palette.midGrey,
    fontSize: "20rem",
    marginRight: "10%",
    marginTop: 0,
    paddingTop: 0,
    textAlign: "center",
    width: "90%",
  },

  domainText: {
    fontSize: 20,
    marginLeft: "4%",
  },
})
